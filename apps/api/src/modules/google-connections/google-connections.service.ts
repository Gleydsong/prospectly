import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../common/prisma/prisma.service';
import { runWithTenant } from '../../common/prisma/tenant-context';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { GOOGLE_OAUTH_PORT, type GoogleOAuthPort } from './google-oauth.port';
import { createGoogleOAuthState, parseGoogleOAuthState } from './oauth-state';
import { encryptRefreshToken } from './token-crypto';

export const GOOGLE_CONNECTION_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
] as const;

export type GoogleConnectionView = {
  connected: boolean;
  googleEmail: string | null;
  connectedAt: string | null;
  lastError: string | null;
};

export type OrgGoogleConnectionView = {
  userId: string;
  googleEmail: string;
  connectedAt: string;
};

function isActive(row: { refreshTokenEncrypted: string | null; revokedAt: Date | null }): boolean {
  return Boolean(row.refreshTokenEncrypted) && !row.revokedAt;
}

function toMineView(row: {
  googleEmail: string;
  connectedAt: Date;
  lastError: string | null;
  refreshTokenEncrypted: string | null;
  revokedAt: Date | null;
} | null): GoogleConnectionView {
  if (!row || !isActive(row)) {
    return { connected: false, googleEmail: null, connectedAt: null, lastError: null };
  }
  return {
    connected: true,
    googleEmail: row.googleEmail,
    connectedAt: row.connectedAt.toISOString(),
    lastError: row.lastError,
  };
}

@Injectable()
export class GoogleConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    @Inject(GOOGLE_OAUTH_PORT) private readonly google: GoogleOAuthPort,
  ) {}

  async getMine(organizationId: string, userId: string): Promise<GoogleConnectionView> {
    const row = await this.prisma.googleConnection.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    return toMineView(row);
  }

  async listOrg(organizationId: string): Promise<OrgGoogleConnectionView[]> {
    const rows = await this.prisma.googleConnection.findMany({
      where: { organizationId, revokedAt: null, refreshTokenEncrypted: { not: null } },
      select: { userId: true, googleEmail: true, connectedAt: true },
      orderBy: { connectedAt: 'desc' },
    });
    return rows.map((row) => ({
      userId: row.userId,
      googleEmail: row.googleEmail,
      connectedAt: row.connectedAt.toISOString(),
    }));
  }

  buildAuthorizationUrl(userId: string, organizationId: string): string {
    const clientId = this.requireConfig('google.clientId');
    const redirectUri = this.requireConfig('google.oauthRedirectUri');
    this.requireConfig('google.clientSecret');
    this.requireConfig('google.tokenEncryptionKey');
    const secret = this.requireConfig('jwt.accessSecret');
    const state = createGoogleOAuthState({ userId, organizationId }, secret);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_CONNECTION_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'false',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async completeFromCallback(code: string, state: string): Promise<GoogleConnectionView> {
    const secret = this.requireConfig('jwt.accessSecret');
    let parsed: { userId: string; organizationId: string };
    try {
      parsed = parseGoogleOAuthState(state, secret);
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }
    return runWithTenant(parsed.organizationId, () =>
      this.persistFromCode(parsed.organizationId, parsed.userId, code),
    );
  }

  async disconnect(organizationId: string, userId: string): Promise<GoogleConnectionView> {
    const row = await this.prisma.googleConnection.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!row || !isActive(row)) {
      return { connected: false, googleEmail: null, connectedAt: null, lastError: null };
    }
    const now = new Date();
    await this.prisma.googleConnection.update({
      where: { id: row.id },
      data: { refreshTokenEncrypted: null, revokedAt: now, lastError: null },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.GOOGLE_CONNECTION_DISCONNECTED,
      entity: 'GoogleConnection',
      entityId: row.id,
      metadata: { googleEmail: row.googleEmail },
    });
    return { connected: false, googleEmail: null, connectedAt: null, lastError: null };
  }

  async revoke(
    organizationId: string,
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    if (actorUserId === targetUserId) {
      await this.disconnect(organizationId, targetUserId);
      return;
    }
    const row = await this.prisma.googleConnection.findUnique({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
    });
    if (!row || !isActive(row)) {
      throw new NotFoundException('Google connection not found');
    }
    const now = new Date();
    await this.prisma.googleConnection.update({
      where: { id: row.id },
      data: { refreshTokenEncrypted: null, revokedAt: now, lastError: null },
    });
    await this.audit.log({
      organizationId,
      userId: actorUserId,
      action: AUDIT_ACTIONS.GOOGLE_CONNECTION_REVOKED,
      entity: 'GoogleConnection',
      entityId: row.id,
      metadata: { googleEmail: row.googleEmail, targetUserId },
    });
  }

  async exportForUser(userId: string): Promise<
    Array<{
      organizationId: string;
      googleEmail: string;
      connectedAt: string;
      revokedAt: string | null;
    }>
  > {
    const rows = await this.prisma.googleConnection.findMany({
      where: { userId },
      select: {
        organizationId: true,
        googleEmail: true,
        connectedAt: true,
        revokedAt: true,
      },
    });
    return rows.map((row) => ({
      organizationId: row.organizationId,
      googleEmail: row.googleEmail,
      connectedAt: row.connectedAt.toISOString(),
      revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    }));
  }

  private async persistFromCode(
    organizationId: string,
    userId: string,
    code: string,
  ): Promise<GoogleConnectionView> {
    const redirectUri = this.requireConfig('google.oauthRedirectUri');
    const keyHex = this.requireConfig('google.tokenEncryptionKey');
    const tokens = await this.google.exchangeAuthorizationCode({ code, redirectUri });
    if (!tokens.refreshToken) {
      throw new BadRequestException('GOOGLE_REFRESH_TOKEN_MISSING');
    }
    const encrypted = encryptRefreshToken(tokens.refreshToken, keyHex);
    const now = new Date();
    const row = await this.prisma.googleConnection.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      create: {
        organizationId,
        userId,
        googleSubject: tokens.googleSubject,
        googleEmail: tokens.googleEmail,
        refreshTokenEncrypted: encrypted,
        scopes: GOOGLE_CONNECTION_SCOPES.join(' '),
        connectedAt: now,
        revokedAt: null,
        lastError: null,
      },
      update: {
        googleSubject: tokens.googleSubject,
        googleEmail: tokens.googleEmail,
        refreshTokenEncrypted: encrypted,
        scopes: GOOGLE_CONNECTION_SCOPES.join(' '),
        connectedAt: now,
        revokedAt: null,
        lastError: null,
      },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.GOOGLE_CONNECTION_CONNECTED,
      entity: 'GoogleConnection',
      entityId: row.id,
      metadata: { googleEmail: tokens.googleEmail },
    });
    return toMineView(row);
  }

  private requireConfig(key: string): string {
    const value = this.config.get<string>(key)?.trim() ?? '';
    if (!value) {
      throw new ServiceUnavailableException('Google connection is not configured');
    }
    return value;
  }
}

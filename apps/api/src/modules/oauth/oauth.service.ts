import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../common/prisma/prisma.service';
import { runWithTenant } from '../../common/prisma/tenant-context';
import { hashOpaque, isAllowedRedirectUri, MCP_SCOPE, verifyPkceS256 } from './oauth-protocol';

export type RegisterClientInput = {
  client_name?: string;
  redirect_uris?: string[];
  token_endpoint_auth_method?: string;
};

export type RegisteredClient = {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: 'none';
};

export type AuthorizeQuery = {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  resource?: string;
  scope?: string;
  state?: string;
};

export type ConsentInput = AuthorizeQuery & {
  organizationId?: string;
  decision: 'allow' | 'deny';
};

export type TokenRequest = {
  grant_type?: string;
  code?: string;
  code_verifier?: string;
  redirect_uri?: string;
  client_id?: string;
  refresh_token?: string;
  resource?: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
};

const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function oauthError(error: string, description: string): never {
  throw new BadRequestException({ error, error_description: description });
}

@Injectable()
export class OauthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  mcpResourceUrl(): string {
    return (this.config.get<string>('mcpResourceUrl') ?? 'http://127.0.0.1:3000/mcp').replace(
      /\/$/,
      '',
    );
  }

  frontendUrl(): string {
    return (this.config.get<string>('frontendUrl') ?? 'http://localhost:5173').replace(/\/$/, '');
  }

  async registerClient(input: RegisterClientInput): Promise<RegisteredClient> {
    const clientName = input.client_name?.trim() || 'MCP client';
    const redirectUris = (input.redirect_uris ?? []).map((uri) => uri.trim()).filter(Boolean);
    if (redirectUris.length === 0 || redirectUris.some((uri) => !isAllowedRedirectUri(uri))) {
      throw new BadRequestException({
        error: 'invalid_request',
        error_description: 'redirect_uris must be https or loopback http',
      });
    }
    if (input.token_endpoint_auth_method && input.token_endpoint_auth_method !== 'none') {
      throw new BadRequestException({
        error: 'invalid_client_metadata',
        error_description: 'Only public clients (token_endpoint_auth_method=none) are supported',
      });
    }

    const client = await this.prisma.oauthClient.create({
      data: {
        clientName,
        redirectUris,
        tokenEndpointAuthMethod: 'none',
      },
    });

    return {
      client_id: client.id,
      client_name: client.clientName,
      redirect_uris: client.redirectUris as string[],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  async buildConsentRedirectUrl(query: AuthorizeQuery): Promise<string> {
    await this.loadValidClient(query);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string' && value.length > 0) params.set(key, value);
    }
    return `${this.frontendUrl()}/oauth/consent?${params.toString()}`;
  }

  async consent(userId: string, input: ConsentInput): Promise<{ redirect: string }> {
    const client = await this.loadValidClient(input);
    const redirectUri = input.redirect_uri!;
    const state = input.state ?? '';

    if (input.decision === 'deny') {
      const denied = new URLSearchParams({ error: 'access_denied' });
      if (state) denied.set('state', state);
      return { redirect: `${redirectUri}?${denied.toString()}` };
    }

    if (!input.organizationId) {
      throw new BadRequestException({
        error: 'invalid_request',
        error_description: 'organizationId is required',
      });
    }

    const organizationId = input.organizationId;
    await this.assertCanAuthorizeOrg(userId, organizationId);

    return runWithTenant(organizationId, async () => {
      const existing = await this.prisma.mcpConnection.findFirst({
        where: {
          organizationId,
          userId,
          clientId: client.id,
          revokedAt: null,
        },
      });
      const connection =
        existing ??
        (await this.prisma.mcpConnection.create({
          data: {
            organizationId,
            userId,
            clientId: client.id,
            clientName: client.clientName,
            scope: MCP_SCOPE,
          },
        }));

      const code = `mcc_${randomBytes(32).toString('base64url')}`;
      await this.prisma.oauthAuthorizationCode.create({
        data: {
          codeHash: hashOpaque(code),
          clientId: client.id,
          userId,
          organizationId,
          connectionId: connection.id,
          redirectUri,
          codeChallenge: input.code_challenge!,
          resource: this.mcpResourceUrl(),
          scope: MCP_SCOPE,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'integration.mcp_connection.granted',
          entity: 'McpConnection',
          entityId: connection.id,
          metadata: { clientId: client.id, clientName: client.clientName },
        },
      });

      const granted = new URLSearchParams({ code });
      if (state) granted.set('state', state);
      return { redirect: `${redirectUri}?${granted.toString()}` };
    }, userId);
  }

  async exchangeToken(input: TokenRequest): Promise<TokenResponse> {
    if (input.grant_type === 'authorization_code') {
      return this.exchangeAuthorizationCode(input);
    }
    if (input.grant_type === 'refresh_token') {
      return this.exchangeRefreshToken(input);
    }
    oauthError('unsupported_grant_type', 'grant_type must be authorization_code or refresh_token');
  }

  async listConnections(organizationId: string) {
    return this.prisma.mcpConnection.findMany({
      where: { organizationId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, clientName: true, createdAt: true, lastUsedAt: true },
    });
  }

  async revokeConnection(organizationId: string, userId: string, id: string): Promise<void> {
    await runWithTenant(organizationId, async () => {
      const connection = await this.prisma.mcpConnection.findFirst({
        where: { id, organizationId, revokedAt: null },
      });
      if (!connection) {
        throw new BadRequestException({ error: 'invalid_request', error_description: 'Connection not found' });
      }
      const now = new Date();
      await this.prisma.mcpConnection.update({ where: { id }, data: { revokedAt: now } });
      await this.prisma.oauthAccessToken.updateMany({
        where: { connectionId: id, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.prisma.oauthRefreshToken.updateMany({
        where: { connectionId: id, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'integration.mcp_connection.revoked',
          entity: 'McpConnection',
          entityId: id,
        },
      });
    }, userId);
  }

  async revokeToken(raw?: string): Promise<void> {
    if (!raw) return;
    const tokenHash = hashOpaque(raw);
    if (raw.startsWith('mca_')) {
      const access = await this.prisma.oauthAccessToken.findUnique({ where: { tokenHash } });
      if (!access || access.revokedAt) return;
      await runWithTenant(access.organizationId, async () => {
        const now = new Date();
        await this.prisma.oauthAccessToken.update({
          where: { id: access.id },
          data: { revokedAt: now },
        });
        await this.prisma.oauthRefreshToken.updateMany({
          where: { accessTokenId: access.id, revokedAt: null },
          data: { revokedAt: now },
        });
      });
      return;
    }
    if (raw.startsWith('mcr_')) {
      const refresh = await this.prisma.oauthRefreshToken.findUnique({ where: { tokenHash } });
      if (!refresh || refresh.revokedAt) return;
      await runWithTenant(refresh.organizationId, async () => {
        const now = new Date();
        await this.prisma.oauthRefreshToken.update({
          where: { id: refresh.id },
          data: { revokedAt: now },
        });
        await this.prisma.oauthAccessToken.update({
          where: { id: refresh.accessTokenId },
          data: { revokedAt: now },
        });
      });
    }
  }

  async resolveAccessToken(raw: string): Promise<{
    organizationId: string;
    userId: string;
    connectionId: string;
    resource: string;
  }> {
    if (!raw.startsWith('mca_')) {
      throw new UnauthorizedException({ error: 'invalid_token', message: 'Not an MCP access token' });
    }
    const row = await this.prisma.oauthAccessToken.findUnique({
      where: { tokenHash: hashOpaque(raw) },
      include: { connection: { select: { revokedAt: true } } },
    });
    if (
      !row ||
      row.revokedAt ||
      row.expiresAt <= new Date() ||
      row.connection.revokedAt ||
      row.resource !== this.mcpResourceUrl()
    ) {
      throw new UnauthorizedException({
        error: 'invalid_token',
        message: 'Access token is invalid or expired',
      });
    }
    await this.prisma.mcpConnection.update({
      where: { id: row.connectionId },
      data: { lastUsedAt: new Date() },
    });
    return {
      organizationId: row.organizationId,
      userId: row.userId,
      connectionId: row.connectionId,
      resource: row.resource,
    };
  }

  private async exchangeAuthorizationCode(input: TokenRequest): Promise<TokenResponse> {
    if (!input.code || !input.code_verifier || !input.redirect_uri || !input.client_id) {
      oauthError('invalid_request', 'code, code_verifier, redirect_uri and client_id are required');
    }
    const row = await this.prisma.oauthAuthorizationCode.findUnique({
      where: { codeHash: hashOpaque(input.code) },
      include: { connection: { select: { id: true, revokedAt: true } } },
    });
    if (
      !row ||
      row.usedAt ||
      row.expiresAt <= new Date() ||
      row.clientId !== input.client_id ||
      row.redirectUri !== input.redirect_uri ||
      row.connection.revokedAt ||
      (input.resource && input.resource !== row.resource) ||
      !verifyPkceS256(input.code_verifier, row.codeChallenge)
    ) {
      oauthError('invalid_grant', 'Authorization code is invalid');
    }
    return runWithTenant(row.organizationId, async () => {
      await this.prisma.oauthAuthorizationCode.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      return this.issueTokens({
        clientId: row.clientId,
        userId: row.userId,
        organizationId: row.organizationId,
        connectionId: row.connectionId,
        resource: row.resource,
      });
    }, row.userId);
  }

  private async exchangeRefreshToken(input: TokenRequest): Promise<TokenResponse> {
    if (!input.refresh_token) {
      oauthError('invalid_request', 'refresh_token is required');
    }
    const stored = await this.prisma.oauthRefreshToken.findUnique({
      where: { tokenHash: hashOpaque(input.refresh_token) },
      include: { connection: { select: { revokedAt: true } }, accessToken: true },
    });
    if (!stored || stored.expiresAt <= new Date() || stored.connection.revokedAt) {
      oauthError('invalid_grant', 'Refresh token is invalid');
    }
    if (stored.revokedAt) {
      await runWithTenant(stored.organizationId, async () => {
        const now = new Date();
        await this.prisma.oauthRefreshToken.updateMany({
          where: { connectionId: stored.connectionId, revokedAt: null },
          data: { revokedAt: now },
        });
        await this.prisma.oauthAccessToken.updateMany({
          where: { connectionId: stored.connectionId, revokedAt: null },
          data: { revokedAt: now },
        });
      });
      oauthError('invalid_grant', 'Refresh token reuse detected');
    }
    return runWithTenant(stored.organizationId, async () => {
      const now = new Date();
      await this.prisma.oauthRefreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: now },
      });
      await this.prisma.oauthAccessToken.update({
        where: { id: stored.accessTokenId },
        data: { revokedAt: now },
      });
      const issued = await this.issueTokens({
        clientId: stored.accessToken.clientId,
        userId: stored.accessToken.userId,
        organizationId: stored.organizationId,
        connectionId: stored.connectionId,
        resource: stored.accessToken.resource,
      });
      const newRefresh = await this.prisma.oauthRefreshToken.findUnique({
        where: { tokenHash: hashOpaque(issued.refresh_token) },
      });
      if (newRefresh) {
        await this.prisma.oauthRefreshToken.update({
          where: { id: stored.id },
          data: { replacedById: newRefresh.id },
        });
      }
      return issued;
    });
  }

  private async issueTokens(input: {
    clientId: string;
    userId: string;
    organizationId: string;
    connectionId: string;
    resource: string;
  }): Promise<TokenResponse> {
    const accessToken = `mca_${randomBytes(32).toString('base64url')}`;
    const refreshToken = `mcr_${randomBytes(32).toString('base64url')}`;
    const now = Date.now();
    const access = await this.prisma.oauthAccessToken.create({
      data: {
        tokenHash: hashOpaque(accessToken),
        clientId: input.clientId,
        userId: input.userId,
        organizationId: input.organizationId,
        connectionId: input.connectionId,
        resource: input.resource,
        scope: MCP_SCOPE,
        expiresAt: new Date(now + ACCESS_TTL_MS),
      },
    });
    await this.prisma.oauthRefreshToken.create({
      data: {
        tokenHash: hashOpaque(refreshToken),
        accessTokenId: access.id,
        connectionId: input.connectionId,
        organizationId: input.organizationId,
        expiresAt: new Date(now + REFRESH_TTL_MS),
      },
    });
    await this.prisma.mcpConnection.update({
      where: { id: input.connectionId },
      data: { lastUsedAt: new Date() },
    });
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: Math.floor(ACCESS_TTL_MS / 1000),
      refresh_token: refreshToken,
      scope: MCP_SCOPE,
    };
  }

  private async assertCanAuthorizeOrg(userId: string, organizationId: string): Promise<void> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { role: true },
    });
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new ForbiddenException('Only OWNER or ADMIN can authorize an MCP connection');
    }
  }

  private async loadValidClient(query: AuthorizeQuery) {
    if (query.response_type && query.response_type !== 'code') {
      throw new BadRequestException({
        error: 'unsupported_response_type',
        error_description: 'response_type must be code',
      });
    }
    if (!query.client_id || !query.redirect_uri || !query.code_challenge) {
      throw new BadRequestException({
        error: 'invalid_request',
        error_description: 'client_id, redirect_uri and code_challenge are required',
      });
    }
    if (query.code_challenge_method && query.code_challenge_method !== 'S256') {
      throw new BadRequestException({
        error: 'invalid_request',
        error_description: 'code_challenge_method must be S256',
      });
    }
    if (query.resource !== this.mcpResourceUrl()) {
      throw new BadRequestException({
        error: 'invalid_target',
        error_description: 'resource must be the Prospectly MCP URL',
      });
    }
    if (query.scope && query.scope !== MCP_SCOPE) {
      throw new BadRequestException({
        error: 'invalid_scope',
        error_description: `scope must be ${MCP_SCOPE}`,
      });
    }

    const client = await this.prisma.oauthClient.findUnique({ where: { id: query.client_id } });
    if (!client) {
      throw new BadRequestException({
        error: 'invalid_client',
        error_description: 'Unknown client_id',
      });
    }
    const uris = Array.isArray(client.redirectUris)
      ? client.redirectUris.filter((item): item is string => typeof item === 'string')
      : [];
    if (!uris.includes(query.redirect_uri)) {
      throw new BadRequestException({
        error: 'invalid_request',
        error_description: 'redirect_uri is not registered',
      });
    }
    return client;
  }
}

export { MCP_SCOPE };


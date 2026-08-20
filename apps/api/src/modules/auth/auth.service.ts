import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Role, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { OAuth2Client } from 'google-auth-library';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { runWithBypass } from '../../common/prisma/tenant-context';
import { MailService } from '../../common/mail/mail.service';
import { SIGNUP_BONUS_CREDITS, TERMS_VERSION } from '../billing/billing.constants';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { buildPasswordResetEmail } from './password-reset-email';
import { RegisterDto } from './dto/register.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: {
    id: string;
    name: string;
    email: string;
    organizationId: string;
    organizationName: string;
    role: Role;
    locale: 'pt' | 'en';
    avatarUrl?: string | null;
    emailVerifiedAt?: string | null;
  };
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const INVALID_CREDENTIALS = 'Invalid credentials';
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const GENERIC_VERIFY_FAIL = 'Invalid or expired verification token';
const GENERIC_RESET_MAIL_FAIL = 'Unable to process password reset right now. Please try again later.';
const REFRESH_REUSE_GRACE_MS = 60_000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {
    this.googleClient = new OAuth2Client(this.config.get<string>('google.clientId') ?? undefined);
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Generic message avoids account enumeration via register.
      throw new ConflictException('Unable to complete registration with the provided data');
    }

    const passwordHash = await argon2.hash(dto.password);
    return runWithBypass(async () => {
      const { user, organizationId, role } = await this.provisionOwnerAccount({
        email,
        name: dto.name.trim(),
        passwordHash,
        organizationName: dto.organizationName.trim(),
        locale: dto.locale,
      });
      const verifiedUser = await this.completeEmailVerificationAfterRegister(user);
      return this.buildAuthResponse(verifiedUser, organizationId, role);
    });
  }

  async googleAuth(dto: GoogleAuthDto): Promise<AuthResponse> {
    const clientId = this.config.get<string>('google.clientId')?.trim();
    if (!clientId) {
      throw new ServiceUnavailableException('Google Sign-In is not configured');
    }

    const payload = dto.accessToken
      ? await this.resolveGoogleProfileFromAccessToken(dto.accessToken, clientId)
      : await this.resolveGoogleProfileFromIdToken(dto.idToken!, clientId);

    const googleId = payload.sub?.trim();
    const email = payload.email?.toLowerCase().trim();
    if (!googleId || !email) {
      throw new UnauthorizedException('Invalid Google credentials');
    }

    const emailVerified =
      payload.email_verified === true || payload.email_verified === 'true';
    const displayName = (payload.name?.trim() || email.split('@')[0] || 'User').slice(0, 120);
    const avatarUrl = payload.picture?.trim() || null;

    const byGoogle = await this.prisma.user.findUnique({
      where: { googleId },
      include: { memberships: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });
    if (byGoogle) {
      const membership = byGoogle.memberships[0];
      if (!membership) {
        throw new UnauthorizedException('User has no organization');
      }
      if (avatarUrl && avatarUrl !== byGoogle.avatarUrl) {
        await this.prisma.user.update({
          where: { id: byGoogle.id },
          data: { avatarUrl },
        });
      }
      return this.buildAuthResponse(byGoogle, membership.organizationId, membership.role);
    }

    const byEmail = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });
    if (byEmail) {
      if (byEmail.googleId && byEmail.googleId !== googleId) {
        throw new ConflictException('Unable to complete registration with the provided data');
      }
      if (!emailVerified && !byEmail.googleId) {
        throw new UnauthorizedException(
          'Sign in with your email and password to link Google to this account',
        );
      }

      const membership = byEmail.memberships[0];
      if (!membership) {
        throw new UnauthorizedException('User has no organization');
      }

      const linked = await this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleId,
          ...(avatarUrl ? { avatarUrl } : {}),
          ...(emailVerified && !byEmail.emailVerifiedAt
            ? { emailVerifiedAt: new Date() }
            : {}),
        },
      });

      return this.buildAuthResponse(linked, membership.organizationId, membership.role);
    }

    if (dto.acceptTerms !== true) {
      throw new BadRequestException('You must accept the Terms of Use and Privacy Policy');
    }

    const organizationName = (
      dto.organizationName?.trim() || `Workspace de ${displayName}`
    ).slice(0, 120);
    const locale = dto.locale ?? 'pt';

    return runWithBypass(async () => {
      const { user, organizationId, role } = await this.provisionOwnerAccount({
        email,
        name: displayName,
        passwordHash: null,
        organizationName,
        locale,
        googleId,
        avatarUrl,
        emailVerifiedAt: emailVerified ? new Date() : null,
      });
      return this.buildAuthResponse(user, organizationId, role);
    });
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked. Try again later.');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS) : null,
        },
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException('User has no organization');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    return this.buildAuthResponse(user, membership.organizationId, membership.role);
  }

  async refresh(refreshToken: string, meta?: { userAgent?: string; ip?: string }): Promise<AuthTokens> {
    let payload: { sub: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    const matches = await argon2.verify(stored.tokenHash, refreshToken);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      const rotatedAgoMs = Date.now() - stored.revokedAt.getTime();
      if (stored.replacedById && rotatedAgoMs <= REFRESH_REUSE_GRACE_MS) {
        return this.issueTokensForStoredRefresh(payload.sub, stored, meta);
      }
      if (stored.replacedById) {
        await this.logoutAll(payload.sub);
      }
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    const tokens = await this.issueTokensForStoredRefresh(payload.sub, stored, meta);

    await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date(), replacedById: this.extractJti(tokens.refreshToken) },
    });

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; jti: string }>(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
      await this.prisma.refreshToken.updateMany({
        where: { id: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Logout is idempotent: invalid tokens are treated as already logged out.
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const env = this.config.get<string>('nodeEnv') ?? process.env.NODE_ENV ?? 'development';
    const prodLike = env === 'production' || env === 'staging';
    if (prodLike && !this.mail.isConfigured()) {
      this.logger.error('Password reset aborted: mail provider is not configured');
      throw new ServiceUnavailableException(GENERIC_RESET_MAIL_FAIL);
    }

    const normalized = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (!user || !user.passwordHash) {
      // Do not reveal account existence (or Google-only accounts without password).
      return;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.sha256(token);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    const frontend = (this.config.get<string>('frontendUrl') ?? 'http://localhost:5173').replace(
      /\/$/,
      '',
    );
    const resetUrl = `${frontend}/reset-password?token=${token}`;
    const locale = user.locale === 'en' ? 'en' : 'pt';
    const content = buildPasswordResetEmail({ locale, resetUrl, frontendUrl: frontend });

    try {
      await this.mail.send({
        to: user.email,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
      this.logger.log(`Password reset email dispatched for user ${user.id}`);
    } catch (err) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash: null, resetTokenExpiresAt: null },
      });
      this.logger.error(
        `Password reset email failed for user ${user.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(GENERIC_RESET_MAIL_FAIL);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { resetTokenHash: this.sha256(token), resetTokenExpiresAt: { gt: new Date() } },
    });
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await argon2.hash(newPassword),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await this.logoutAll(user.id);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await argon2.hash(dto.newPassword) },
    });
    await this.logoutAll(user.id);
  }

  async verifyEmail(token: string, meta?: { ip?: string }): Promise<void> {
    const hash = this.sha256(token);
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerifyTokenHash: hash,
        emailVerifyTokenExpiresAt: { gt: new Date() },
      },
    });
    if (!user) {
      this.logger.warn({ outcome: 'verify_email_failed', ip: meta?.ip }, 'email verification failed');
      throw new BadRequestException(GENERIC_VERIFY_FAIL);
    }

    if (user.pendingEmail) {
      const taken = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: user.pendingEmail }, { pendingEmail: user.pendingEmail }],
          NOT: { id: user.id },
        },
      });
      if (taken) {
        this.logger.warn(
          { outcome: 'verify_email_pending_taken', userId: user.id, ip: meta?.ip },
          'pending email no longer available',
        );
        throw new BadRequestException(GENERIC_VERIFY_FAIL);
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: user.pendingEmail,
          pendingEmail: null,
          emailVerifiedAt: new Date(),
          emailVerifyTokenHash: null,
          emailVerifyTokenExpiresAt: null,
        },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: new Date(),
          emailVerifyTokenHash: null,
          emailVerifyTokenExpiresAt: null,
        },
      });
    }
    this.logger.log({ outcome: 'verify_email_ok', userId: user.id, ip: meta?.ip }, 'email verified');
  }

  async resendVerification(userId: string, meta?: { ip?: string }): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const targetEmail = user?.pendingEmail ?? user?.email;
    if (!user || (!user.pendingEmail && user.emailVerifiedAt) || !targetEmail) {
      this.logger.log(
        { outcome: 'resend_verification_noop', userId, ip: meta?.ip },
        'resend verification',
      );
      return { message: 'If verification is required, an email was sent.' };
    }
    await this.issueEmailVerification(user.id, targetEmail, user.locale);
    this.logger.log(
      { outcome: 'resend_verification_sent', userId, ip: meta?.ip },
      'resend verification',
    );
    return { message: 'If verification is required, an email was sent.' };
  }

  async changeEmail(
    userId: string,
    input: { newEmail: string; currentPassword: string },
    meta?: { ip?: string },
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const valid = await argon2.verify(user.passwordHash, input.currentPassword);
    if (!valid) {
      this.logger.warn({ outcome: 'change_email_bad_password', userId, ip: meta?.ip });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const email = input.newEmail.toLowerCase().trim();
    if (email === user.email) {
      return { message: 'If the change is allowed, a verification email was sent.' };
    }

    const taken = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { pendingEmail: email }],
        NOT: { id: userId },
      },
    });
    if (taken) {
      // Anti-enumeration: same response, no change
      this.logger.warn({ outcome: 'change_email_taken', userId, ip: meta?.ip });
      return { message: 'If the change is allowed, a verification email was sent.' };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        pendingEmail: email,
        emailVerifyTokenHash: null,
        emailVerifyTokenExpiresAt: null,
      },
    });
    await this.issueEmailVerification(userId, email, user.locale);
    this.logger.log({ outcome: 'change_email_ok', userId, ip: meta?.ip }, 'email change pending');
    return { message: 'If the change is allowed, a verification email was sent.' };
  }

  async switchOrganization(userId: string, organizationId: string): Promise<AuthTokens> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!membership) {
      throw new UnauthorizedException('Not a member of this organization');
    }
    await this.logoutAll(userId);
    return this.issueTokens(userId, organizationId, membership.role);
  }

  private async resolveGoogleProfileFromIdToken(
    idToken: string,
    clientId: string,
  ): Promise<{
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    picture?: string;
  }> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      return ticket.getPayload() ?? {};
    } catch (error) {
      this.logger.warn(`Google ID token verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid Google credentials');
    }
  }

  private async resolveGoogleProfileFromAccessToken(
    accessToken: string,
    clientId: string,
  ): Promise<{
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    picture?: string;
  }> {
    try {
      const tokenInfoRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
      );
      if (!tokenInfoRes.ok) {
        throw new Error(`tokeninfo HTTP ${tokenInfoRes.status}`);
      }
      const tokenInfo = (await tokenInfoRes.json()) as { aud?: string; azp?: string };
      const audience = tokenInfo.aud ?? tokenInfo.azp;
      if (audience !== clientId) {
        throw new Error('access token audience mismatch');
      }

      const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!profileRes.ok) {
        throw new Error(`userinfo HTTP ${profileRes.status}`);
      }
      return (await profileRes.json()) as {
        sub?: string;
        email?: string;
        email_verified?: boolean | string;
        name?: string;
        picture?: string;
      };
    } catch (error) {
      this.logger.warn(`Google access token verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid Google credentials');
    }
  }

  private async provisionOwnerAccount(input: {
    email: string;
    name: string;
    passwordHash: string | null;
    organizationName: string;
    locale: 'pt' | 'en';
    googleId?: string;
    avatarUrl?: string | null;
    emailVerifiedAt?: Date | null;
  }): Promise<{ user: User; organizationId: string; role: Role }> {
    const slug = await this.generateOrgSlug(input.organizationName);
    const acceptedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug,
          creditBalance: SIGNUP_BONUS_CREDITS,
        },
      });

      await tx.creditLedgerEntry.create({
        data: {
          organizationId: organization.id,
          reason: 'SIGNUP_BONUS',
          delta: SIGNUP_BONUS_CREDITS,
          balanceAfter: SIGNUP_BONUS_CREDITS,
          idempotencyKey: `signup-bonus:${organization.id}`,
        },
      });

      const createdUser = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash: input.passwordHash,
          locale: input.locale,
          googleId: input.googleId,
          avatarUrl: input.avatarUrl ?? undefined,
          emailVerifiedAt: input.emailVerifiedAt ?? undefined,
          termsAcceptedAt: acceptedAt,
          termsVersion: TERMS_VERSION,
          privacyAcceptedAt: acceptedAt,
        },
      });

      const membership = await tx.organizationMember.create({
        data: { userId: createdUser.id, organizationId: organization.id, role: 'OWNER' },
      });

      const pipeline = await tx.pipeline.create({
        data: { organizationId: organization.id, name: 'Pipeline padrão', isDefault: true },
      });

      const stages: Array<{
        name: string;
        order: number;
        color: string;
        isWon?: boolean;
        isLost?: boolean;
      }> = [
        { name: 'Novos', order: 0, color: '#6366f1' },
        { name: 'Em análise', order: 1, color: '#0ea5e9' },
        { name: 'Qualificados', order: 2, color: '#14b8a6' },
        { name: 'Contatados', order: 3, color: '#f59e0b' },
        { name: 'Responderam', order: 4, color: '#f97316' },
        { name: 'Reunião marcada', order: 5, color: '#8b5cf6' },
        { name: 'Proposta enviada', order: 6, color: '#d946ef' },
        { name: 'Negociação', order: 7, color: '#ec4899' },
        { name: 'Ganhos', order: 8, color: '#22c55e', isWon: true },
        { name: 'Perdidos', order: 9, color: '#ef4444', isLost: true },
      ];
      await tx.pipelineStage.createMany({
        data: stages.map((stage) => ({ ...stage, pipelineId: pipeline.id })),
      });

      return { user: createdUser, organizationId: organization.id, role: membership.role };
    });
  }

  private async buildAuthResponse(user: User, organizationId: string, role: Role): Promise<AuthResponse> {
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const tokens = await this.issueTokens(user.id, organizationId, role);
    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        organizationId,
        organizationName: organization.name,
        role,
        locale: user.locale,
        avatarUrl: user.avatarUrl ?? null,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      },
    };
  }

  /**
   * Production with Resend/SMTP: send verification mail (checkout stays gated until click).
   * Staging without a mail provider: auto-verify so register + payments work.
   * Mail configured but send fails: account exists, stays unverified — never 500.
   */
  private async completeEmailVerificationAfterRegister(user: User): Promise<User> {
    if (!this.mail.isConfigured()) {
      this.logger.warn(
        `Mail not configured — auto-verifying ${user.email} (set RESEND_API_KEY or SMTP_* to require inbox confirmation)`,
      );
      return this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }

    try {
      await this.issueEmailVerification(user.id, user.email, user.locale);
    } catch (err) {
      this.logger.error(
        `Verification email failed for ${user.email}; account created but remains unverified`,
        err instanceof Error ? err.stack : String(err),
      );
    }
    return user;
  }

  private async issueEmailVerification(
    userId: string,
    email: string,
    locale: 'pt' | 'en',
  ): Promise<void> {
    const raw = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifyTokenHash: this.sha256(raw),
        emailVerifyTokenExpiresAt: expiresAt,
      },
    });

    const frontend = this.config.get<string>('frontendUrl') ?? 'http://localhost:5173';
    const link = `${frontend.replace(/\/$/, '')}/verify-email?token=${raw}`;
    const subject =
      locale === 'en' ? 'Verify your Prospectly email' : 'Verifique o seu e-mail Prospectly';
    const text =
      locale === 'en'
        ? `Open this link to verify your email (expires in 24h):\n\n${link}\n`
        : `Abra este link para verificar o seu e-mail (expira em 24h):\n\n${link}\n`;

    await this.mail.send({ to: email, subject, text });
  }

  private async issueTokensForStoredRefresh(
    userId: string,
    stored: { organizationId: string | null; replacedById: string | null },
    meta?: { userAgent?: string; ip?: string },
  ): Promise<AuthTokens> {
    let organizationId = stored.organizationId;

    if (!organizationId && stored.replacedById) {
      const successor = await this.prisma.refreshToken.findUnique({
        where: { id: stored.replacedById },
        select: { organizationId: true },
      });
      organizationId = successor?.organizationId ?? null;
    }

    const membership = await this.resolveRefreshMembership(userId, organizationId);
    return this.issueTokens(userId, membership.organizationId, membership.role, meta);
  }

  private async resolveRefreshMembership(userId: string, organizationId: string | null) {
    if (organizationId) {
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: { userId, organizationId },
        },
      });
      if (!membership) {
        throw new UnauthorizedException('User has no organization');
      }
      return membership;
    }

    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: 2,
    });
    if (memberships.length === 1) {
      return memberships[0]!;
    }
    throw new UnauthorizedException('Refresh token expired or revoked');
  }

  private async issueTokens(
    userId: string,
    organizationId: string,
    role: Role,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<AuthTokens> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const accessToken = await this.jwt.signAsync(
      { sub: userId, email: user.email, orgId: organizationId, role },
      {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessExpiresIn') ?? '15m',
      },
    );

    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti, orgId: organizationId },
      {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpiresIn') ?? '7d',
      },
    );

    const decoded = this.jwt.decode(refreshToken) as { exp?: number };
    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId,
        organizationId,
        tokenHash: await argon2.hash(refreshToken),
        userAgent: meta?.userAgent,
        ip: meta?.ip,
        expiresAt: decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 86400000),
      },
    });

    return { accessToken, refreshToken };
  }

  private extractJti(refreshToken: string): string | undefined {
    const decoded = this.jwt.decode(refreshToken) as { jti?: string } | null;
    return decoded?.jti;
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async generateOrgSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 48) || 'org';
    let slug = base;
    let counter = 1;
    while (await this.prisma.organization.findUnique({ where: { slug } })) {
      counter += 1;
      slug = `${base}-${counter}`;
    }
    return slug;
  }
}

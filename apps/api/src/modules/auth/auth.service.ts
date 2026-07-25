import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Role, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { TERMS_VERSION } from '../billing/billing.constants';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
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
  };
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const INVALID_CREDENTIALS = 'Invalid credentials';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(dto.password);
    const slug = await this.generateOrgSlug(dto.organizationName);
    const acceptedAt = new Date();

    const { user, organizationId, role } = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: dto.organizationName.trim(), slug },
      });

      const createdUser = await tx.user.create({
        data: {
          email,
          name: dto.name.trim(),
          passwordHash,
          locale: dto.locale,
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

      const stages: Array<{ name: string; order: number; color: string; isWon?: boolean; isLost?: boolean }> = [
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

    return this.buildAuthResponse(user, organizationId, role);
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
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    const matches = await argon2.verify(stored.tokenHash, refreshToken);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId: payload.sub },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) {
      throw new UnauthorizedException('User has no organization');
    }

    const tokens = await this.issueTokens(payload.sub, membership.organizationId, membership.role, meta);

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
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
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      // Do not reveal account existence.
      return;
    }
    const token = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: this.sha256(token),
        resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    // TODO(phase-6): send via SMTP provider. Logged in non-production only.
    if (this.config.get<string>('nodeEnv') !== 'production') {
      this.logger.log(`Password reset token for ${user.email}: ${token}`);
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

  async verifyEmail(token: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyTokenHash: this.sha256(token) },
    });
    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), emailVerifyTokenHash: null },
    });
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
      },
    };
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
      { sub: userId, jti },
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

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

const TOKEN_PREFIX = 'pst_';

@Injectable()
export class PluginAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async listTokens(organizationId: string) {
    return this.prisma.pluginToken.findMany({
      where: { organizationId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, tokenPrefix: true, lastUsedAt: true, createdAt: true },
    });
  }

  async createToken(organizationId: string, userId: string, name: string) {
    const cleanName = name.trim();
    if (cleanName.length < 2 || cleanName.length > 80) {
      throw new BadRequestException('Plugin name must have between 2 and 80 characters');
    }

    const raw = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    const tokenPrefix = `${raw.slice(0, 12)}…`;
    const token = await this.prisma.pluginToken.create({
      data: {
        organizationId,
        name: cleanName,
        tokenHash: this.hash(raw),
        tokenPrefix,
      },
      select: { id: true, name: true, tokenPrefix: true, createdAt: true },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: 'integration.plugin_token.created',
        entity: 'PluginToken',
        entityId: token.id,
        metadata: { name: cleanName, tokenPrefix },
      },
    });

    return { ...token, token: raw };
  }

  async revokeToken(organizationId: string, userId: string, id: string): Promise<void> {
    const result = await this.prisma.pluginToken.updateMany({
      where: { id, organizationId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) throw new BadRequestException('Plugin token not found');
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: 'integration.plugin_token.revoked',
        entity: 'PluginToken',
        entityId: id,
      },
    });
  }

  async resolveOrganization(rawToken: string | undefined): Promise<string> {
    if (!rawToken || !rawToken.startsWith(TOKEN_PREFIX)) {
      throw new UnauthorizedException('Plugin key is missing or invalid');
    }
    const token = await this.prisma.pluginToken.findUnique({
      where: { tokenHash: this.hash(rawToken) },
      select: { id: true, organizationId: true, revokedAt: true },
    });
    if (!token || token.revokedAt) throw new UnauthorizedException('Plugin key is invalid or revoked');
    await this.prisma.pluginToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
    return token.organizationId;
  }

  async extract(organizationId: string, resource: string, limit = 25) {
    const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? Math.floor(limit) : 25, 1), 100);
    if (resource === 'leads') {
      return this.prisma.lead.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: safeLimit,
        select: {
          id: true, companyName: true, tradeName: true, category: true, city: true, state: true,
          email: true, phone: true, website: true, status: true, source: true, updatedAt: true,
        },
      });
    }
    if (resource === 'searches') {
      return this.prisma.search.findMany({
        where: { organizationId }, orderBy: { createdAt: 'desc' }, take: safeLimit,
        select: { id: true, provider: true, status: true, input: true, createdAt: true, completedAt: true },
      });
    }
    if (resource === 'summary') {
      const [organization, leadCount, searchCount] = await Promise.all([
        this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, creditBalance: true, plan: true } }),
        this.prisma.lead.count({ where: { organizationId, deletedAt: null } }),
        this.prisma.search.count({ where: { organizationId } }),
      ]);
      return { organization, leadCount, searchCount };
    }
    throw new BadRequestException('Unsupported plugin resource');
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}

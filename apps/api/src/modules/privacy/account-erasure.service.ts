import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { runWithBypass } from '../../common/prisma/tenant-context';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';

export const LAST_OWNER_CANNOT_SELF_DELETE = 'LAST_OWNER_CANNOT_SELF_DELETE';

@Injectable()
export class AccountErasureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async eraseAccount(userId: string, organizationId?: string | null): Promise<void> {
    await runWithBypass(async () => {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, anonymizedAt: true },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (user.anonymizedAt) {
        return;
      }

      const ownerMemberships = await this.prisma.organizationMember.findMany({
        where: { userId, role: 'OWNER' },
        select: { organizationId: true },
      });
      for (const membership of ownerMemberships) {
        const otherOwners = await this.prisma.organizationMember.count({
          where: {
            organizationId: membership.organizationId,
            role: 'OWNER',
            userId: { not: userId },
          },
        });
        if (otherOwners === 0) {
          throw new ConflictException(LAST_OWNER_CANNOT_SELF_DELETE);
        }
      }

      const now = new Date();
      await this.prisma.$transaction(async (tx) => {
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.lead.updateMany({ where: { ownerId: userId }, data: { ownerId: null } });
        await tx.organizationMember.deleteMany({ where: { userId } });
        await tx.user.update({
          where: { id: userId },
          data: {
            email: `deleted+${userId}@anonymized.invalid`,
            pendingEmail: null,
            name: 'Usuário excluído',
            passwordHash: null,
            avatarUrl: null,
            googleId: null,
            githubId: null,
            emailVerifyTokenHash: null,
            emailVerifyTokenExpiresAt: null,
            resetTokenHash: null,
            resetTokenExpiresAt: null,
            anonymizedAt: now,
          },
        });
      });

      await this.audit.log({
        organizationId: organizationId ?? null,
        userId,
        action: AUDIT_ACTIONS.ACCOUNT_ANONYMIZED,
        entity: 'User',
        entityId: userId,
        metadata: { anonymized: true },
      });
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { runWithBypass } from '../../common/prisma/tenant-context';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AccountExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async exportAccount(userId: string, organizationId?: string | null) {
    return runWithBypass(async () => {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          locale: true,
          avatarUrl: true,
          emailVerifiedAt: true,
          termsAcceptedAt: true,
          termsVersion: true,
          privacyAcceptedAt: true,
          createdAt: true,
          updatedAt: true,
          anonymizedAt: true,
        },
      });
      if (!user || user.anonymizedAt) {
        throw new NotFoundException('User not found');
      }

      const [memberships, consents, requests, searches, opportunityRuns, aiRuns, googleConnections] =
        await Promise.all([
          this.prisma.organizationMember.findMany({
            where: { userId },
            select: {
              role: true,
              createdAt: true,
              organization: { select: { id: true, name: true, slug: true } },
            },
          }),
          this.prisma.consentRecord.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: {
              type: true,
              granted: true,
              version: true,
              source: true,
              privacyPolicyVersion: true,
              termsVersion: true,
              grantedAt: true,
              withdrawnAt: true,
              createdAt: true,
            },
          }),
          this.prisma.dataSubjectRequest.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              type: true,
              status: true,
              createdAt: true,
              completedAt: true,
            },
          }),
          this.prisma.search.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 200,
            select: {
              id: true,
              provider: true,
              input: true,
              status: true,
              createdAt: true,
              completedAt: true,
            },
          }),
          this.prisma.opportunityRun.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: {
              id: true,
              service: true,
              city: true,
              state: true,
              status: true,
              createdAt: true,
              completedAt: true,
            },
          }),
          this.prisma.aiRun.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: {
              id: true,
              task: true,
              provider: true,
              model: true,
              promptVersion: true,
              status: true,
              createdAt: true,
              completedAt: true,
            },
          }),
          this.prisma.googleConnection.findMany({
            where: { userId },
            orderBy: { connectedAt: 'desc' },
            select: {
              organizationId: true,
              googleEmail: true,
              connectedAt: true,
              revokedAt: true,
            },
          }),
        ]);

      await this.audit.log({
        organizationId: organizationId ?? null,
        userId,
        action: AUDIT_ACTIONS.DATA_EXPORTED,
        entity: 'User',
        entityId: userId,
        metadata: {
          membershipCount: memberships.length,
          searchCount: searches.length,
        },
      });

      return {
        exportedAt: new Date().toISOString(),
        subject: user,
        memberships,
        consents,
        dataSubjectRequests: requests,
        searches,
        opportunityRuns,
        aiRuns,
        googleConnections,
      };
    });
  }
}

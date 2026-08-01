import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AppLocale } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';

export const DSR_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
} as const;

export type DataSubjectRequestType = 'DELETE' | 'EXPORT';

const DSR_PUBLIC_SELECT = {
  id: true,
  userId: true,
  type: true,
  status: true,
  notes: true,
  reviewedById: true,
  reviewedAt: true,
  approvedAt: true,
  completedAt: true,
  confirmationSentAt: true,
  confirmationChannel: true,
  confirmationNote: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true, name: true } },
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        locale: true,
        emailVerifiedAt: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(
    userId: string,
    data: { name?: string; avatarUrl?: string; locale?: AppLocale },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name?.trim(),
        avatarUrl: data.avatarUrl,
        locale: data.locale,
      },
      select: { id: true, name: true, email: true, avatarUrl: true, locale: true },
    });
  }

  async createDataSubjectRequest(
    userId: string,
    type: DataSubjectRequestType,
    notes?: string,
    organizationId?: string,
  ) {
    const request = await this.prisma.dataSubjectRequest.create({
      data: {
        userId,
        type,
        status: DSR_STATUS.PENDING,
        notes: notes?.trim() || `Solicitação ${type} via API (MVP — revisão administrativa)`,
      },
      select: { id: true, type: true, status: true, createdAt: true },
    });

    await this.audit.log({
      organizationId: organizationId ?? null,
      userId,
      action: AUDIT_ACTIONS.DSR_CREATED,
      entity: 'DataSubjectRequest',
      entityId: request.id,
      metadata: { type: request.type, status: request.status },
    });

    return request;
  }

  /** OWNER: list DSRs for members of the current organization. */
  async listDataSubjectRequests(organizationId: string) {
    const memberIds = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    const userIds = memberIds.map((m) => m.userId);
    if (userIds.length === 0) {
      return [];
    }

    return this.prisma.dataSubjectRequest.findMany({
      where: { userId: { in: userIds } },
      select: DSR_PUBLIC_SELECT,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async approveDataSubjectRequest(
    organizationId: string,
    requestId: string,
    reviewerId: string,
  ) {
    const request = await this.findOrgScopedRequest(organizationId, requestId);
    if (request.status === DSR_STATUS.COMPLETED) {
      throw new BadRequestException('Request is already completed');
    }
    if (request.status === DSR_STATUS.REJECTED) {
      throw new BadRequestException('Rejected requests cannot be approved');
    }
    if (request.status === DSR_STATUS.APPROVED) {
      return this.prisma.dataSubjectRequest.findUniqueOrThrow({
        where: { id: requestId },
        select: DSR_PUBLIC_SELECT,
      });
    }

    const now = new Date();
    const updated = await this.prisma.dataSubjectRequest.update({
      where: { id: requestId },
      data: {
        status: DSR_STATUS.APPROVED,
        reviewedById: reviewerId,
        reviewedAt: now,
        approvedAt: now,
      },
      select: DSR_PUBLIC_SELECT,
    });

    await this.audit.log({
      organizationId,
      userId: reviewerId,
      action: AUDIT_ACTIONS.DSR_APPROVED,
      entity: 'DataSubjectRequest',
      entityId: requestId,
      metadata: { type: updated.type, subjectUserId: updated.userId },
    });

    void this.processApprovedRequestStub(organizationId, requestId, reviewerId);

    return updated;
  }

  async completeDataSubjectRequest(
    organizationId: string,
    requestId: string,
    reviewerId: string,
    options?: { confirmationNote?: string; confirmationChannel?: string },
  ) {
    const request = await this.findOrgScopedRequest(organizationId, requestId);
    if (request.status === DSR_STATUS.COMPLETED) {
      return this.prisma.dataSubjectRequest.findUniqueOrThrow({
        where: { id: requestId },
        select: DSR_PUBLIC_SELECT,
      });
    }
    if (request.status === DSR_STATUS.REJECTED) {
      throw new BadRequestException('Rejected requests cannot be completed');
    }
    if (request.status === DSR_STATUS.PENDING) {
      throw new BadRequestException('Approve the request before completing');
    }

    return this.markCompleted(organizationId, requestId, reviewerId, options);
  }

  /**
   * Async stub: after approval, mark the request completed with confirmation fields.
   * Real export/delete execution lands in a later phase.
   */
  private async processApprovedRequestStub(
    organizationId: string,
    requestId: string,
    reviewerId: string,
  ): Promise<void> {
    try {
      await Promise.resolve();
      const current = await this.prisma.dataSubjectRequest.findUnique({
        where: { id: requestId },
        select: { status: true, type: true },
      });
      if (!current || current.status !== DSR_STATUS.APPROVED) {
        return;
      }

      await this.markCompleted(organizationId, requestId, reviewerId, {
        confirmationChannel: 'email_stub',
        confirmationNote: `Stub ${current.type}: processamento assíncrono registrado; execução real pendente.`,
      });
    } catch (error) {
      this.logger.warn({
        message: 'DSR async stub failed',
        requestId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  private async markCompleted(
    organizationId: string,
    requestId: string,
    reviewerId: string,
    options?: { confirmationNote?: string; confirmationChannel?: string },
  ) {
    const now = new Date();
    const result = await this.prisma.dataSubjectRequest.updateMany({
      where: { id: requestId, status: DSR_STATUS.APPROVED },
      data: {
        status: DSR_STATUS.COMPLETED,
        completedAt: now,
        confirmationSentAt: now,
        confirmationChannel: options?.confirmationChannel?.trim() || 'manual',
        confirmationNote:
          options?.confirmationNote?.trim() ||
          'Confirmação registrada (MVP stub).',
        reviewedById: reviewerId,
        reviewedAt: now,
      },
    });

    const updated = await this.prisma.dataSubjectRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: DSR_PUBLIC_SELECT,
    });

    if (result.count > 0) {
      await this.audit.log({
        organizationId,
        userId: reviewerId,
        action: AUDIT_ACTIONS.DSR_COMPLETED,
        entity: 'DataSubjectRequest',
        entityId: requestId,
        metadata: {
          type: updated.type,
          subjectUserId: updated.userId,
          confirmationChannel: updated.confirmationChannel,
        },
      });
    }

    return updated;
  }

  private async findOrgScopedRequest(organizationId: string, requestId: string) {
    const request = await this.prisma.dataSubjectRequest.findUnique({
      where: { id: requestId },
      select: { id: true, userId: true, status: true, type: true },
    });
    if (!request) {
      throw new NotFoundException('Data subject request not found');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId: request.userId, organizationId },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new NotFoundException('Data subject request not found');
    }

    return request;
  }
}

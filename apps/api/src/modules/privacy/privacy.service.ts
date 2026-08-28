import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { DSR_STATUS } from '../users/users.service';
import { ConsentService } from './consent.service';
import type { PrivacyRequestType } from './dto/create-privacy-request.dto';

@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly consents: ConsentService,
  ) {}

  async getSnapshot(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        locale: true,
        emailVerifiedAt: true,
        termsAcceptedAt: true,
        termsVersion: true,
        privacyAcceptedAt: true,
        createdAt: true,
        anonymizedAt: true,
        memberships: {
          select: {
            role: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!user || user.anonymizedAt) {
      throw new NotFoundException('User not found');
    }
    const consents = await this.consents.list(userId);
    const { anonymizedAt: _anonymizedAt, ...profile } = user;
    return { profile, consents };
  }

  async correctName(userId: string, name: string | undefined, organizationId?: string | null) {
    if (!name?.trim()) {
      throw new BadRequestException('Name is required');
    }
    const profile = await this.prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
      select: { id: true, name: true, email: true, locale: true },
    });
    await this.audit.log({
      organizationId: organizationId ?? null,
      userId,
      action: AUDIT_ACTIONS.PRIVACY_CORRECTION,
      entity: 'User',
      entityId: userId,
      metadata: { fields: ['name'] },
    });
    return profile;
  }

  async createRequest(
    userId: string,
    organizationId: string,
    type: PrivacyRequestType,
    notes?: string,
  ) {
    const storedType = type === 'DELETION' ? 'DELETE' : type === 'EXPORT' ? 'EXPORT' : type;
    const request = await this.prisma.dataSubjectRequest.create({
      data: {
        userId,
        organizationId,
        type: storedType,
        status: DSR_STATUS.PENDING,
        notes: notes?.trim() || `Solicitação ${type} via /privacy/requests`,
      },
      select: { id: true, type: true, status: true, createdAt: true },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.DSR_CREATED,
      entity: 'DataSubjectRequest',
      entityId: request.id,
      metadata: { type: request.type, status: request.status },
    });
    return request;
  }
}

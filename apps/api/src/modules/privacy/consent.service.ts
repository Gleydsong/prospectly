import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '../billing/billing.constants';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';

export const CONSENT_TYPES = {
  TERMS: 'TERMS',
  PRIVACY: 'PRIVACY',
  COOKIES_ESSENTIAL: 'COOKIES_ESSENTIAL',
  COOKIES_ANALYTICS: 'COOKIES_ANALYTICS',
  MARKETING: 'MARKETING',
} as const;

export type ConsentType = (typeof CONSENT_TYPES)[keyof typeof CONSENT_TYPES];

type ConsentWriter = Pick<Prisma.TransactionClient, 'consentRecord'>;

@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async recordSignupConsents(
    writer: ConsentWriter,
    userId: string,
    source: string,
    acceptedAt: Date,
  ): Promise<void> {
    await writer.consentRecord.createMany({
      data: [
        {
          userId,
          type: CONSENT_TYPES.TERMS,
          granted: true,
          version: TERMS_VERSION,
          source,
          termsVersion: TERMS_VERSION,
          privacyPolicyVersion: PRIVACY_POLICY_VERSION,
          grantedAt: acceptedAt,
        },
        {
          userId,
          type: CONSENT_TYPES.PRIVACY,
          granted: true,
          version: PRIVACY_POLICY_VERSION,
          source,
          termsVersion: TERMS_VERSION,
          privacyPolicyVersion: PRIVACY_POLICY_VERSION,
          grantedAt: acceptedAt,
        },
      ],
    });
  }

  async list(userId: string) {
    return this.prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
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
    });
  }

  async grant(
    userId: string,
    type: ConsentType,
    source: string,
    organizationId?: string | null,
  ) {
    const now = new Date();
    const version = type === CONSENT_TYPES.TERMS ? TERMS_VERSION : PRIVACY_POLICY_VERSION;
    const record = await this.prisma.consentRecord.create({
      data: {
        userId,
        type,
        granted: true,
        version,
        source,
        termsVersion: TERMS_VERSION,
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
        grantedAt: now,
      },
      select: {
        id: true,
        type: true,
        granted: true,
        version: true,
        source: true,
        grantedAt: true,
        withdrawnAt: true,
      },
    });
    await this.audit.log({
      organizationId: organizationId ?? null,
      userId,
      action: AUDIT_ACTIONS.CONSENT_CHANGED,
      entity: 'ConsentRecord',
      entityId: record.id,
      metadata: { type, granted: true },
    });
    return record;
  }

  async withdraw(
    userId: string,
    type: ConsentType,
    organizationId?: string | null,
  ) {
    const now = new Date();
    const latest = await this.prisma.consentRecord.findFirst({
      where: { userId, type, withdrawnAt: null, granted: true },
      orderBy: { createdAt: 'desc' },
    });
    if (latest) {
      await this.prisma.consentRecord.update({
        where: { id: latest.id },
        data: { withdrawnAt: now, granted: false },
      });
    }
    const record = await this.prisma.consentRecord.create({
      data: {
        userId,
        type,
        granted: false,
        version: type === CONSENT_TYPES.TERMS ? TERMS_VERSION : PRIVACY_POLICY_VERSION,
        source: 'privacy_api',
        termsVersion: TERMS_VERSION,
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
        grantedAt: latest?.grantedAt ?? now,
        withdrawnAt: now,
      },
      select: {
        id: true,
        type: true,
        granted: true,
        version: true,
        source: true,
        grantedAt: true,
        withdrawnAt: true,
      },
    });
    await this.audit.log({
      organizationId: organizationId ?? null,
      userId,
      action: AUDIT_ACTIONS.CONSENT_CHANGED,
      entity: 'ConsentRecord',
      entityId: record.id,
      metadata: { type, granted: false },
    });
    return record;
  }
}

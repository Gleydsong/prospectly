import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgPlan, PaymentProvider, PlanStatus, Role, type Prisma } from '@prisma/client';

import { MailService } from '../../common/mail/mail.service';
import { buildMonthlyPurchasedEmail } from '../../common/mail/templates/monthly-purchased-email';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { BillingDb } from './billing-db';
import type { BillingCurrency } from './domain/payment-provider';

export type MonthlyActivationResult = {
  applied: boolean;
  shouldSendReceipt: boolean;
};

export type MonthlyPlanReceipt = {
  organizationId: string;
  amountCentavos: number;
  currency: 'BRL';
  periodEnd?: Date | null;
  paymentMethod?: 'PIX' | 'CARD';
  purchasedAt?: Date;
};

const SKIPPED_MONTHLY_ACTIVATION: MonthlyActivationResult = {
  applied: false,
  shouldSendReceipt: false,
};

@Injectable()
export class BillingActivationService {
  private readonly logger = new Logger(BillingActivationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Activate lifetime entitlement. Returns any prior monthly subscription IDs so
   * callers can cancel the external subscription (activateLifetime clears local IDs).
   */
  async activateLifetime(input: {
    organizationId: string;
    currency: BillingCurrency;
    provider: PaymentProvider;
    stripeCustomerId?: string | null;
    tx?: Prisma.TransactionClient;
  }): Promise<{
    previousStripeSubscriptionId: string | null;
  }> {
    const db = this.db(input.tx);
    const org = await db.organization.findUnique({
      where: { id: input.organizationId },
    });
    if (!org) {
      this.logger.warn(`activateLifetime: org ${input.organizationId} not found`);
      return {
        previousStripeSubscriptionId: null,
      };
    }

    const previousStripeSubscriptionId = org.stripeSubscriptionId;

    await db.organization.update({
      where: { id: input.organizationId },
      data: {
        plan: OrgPlan.LIFETIME,
        planStatus: PlanStatus.ACTIVE,
        planCurrency: input.currency,
        paymentProvider: input.provider,
        currentPeriodEnd: null,
        stripeSubscriptionId: null,
        ...(input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : {}),
      },
    });

    return { previousStripeSubscriptionId };
  }

  /**
   * Revoke a one-time (lifetime) entitlement after refund / payment loss.
   * Only downgrades when the org is still on LIFETIME for the same provider
   * (and matching payment id when available).
   */
  async revokeLifetime(input: {
    organizationId: string;
    provider: PaymentProvider;
    stripeCustomerId?: string | null;
    tx?: Prisma.TransactionClient;
  }): Promise<void> {
    const db = this.db(input.tx);
    const org = await db.organization.findUnique({
      where: { id: input.organizationId },
    });
    if (!org) {
      this.logger.warn(`revokeLifetime: org ${input.organizationId} not found`);
      return;
    }
    if (org.plan !== OrgPlan.LIFETIME || org.paymentProvider !== input.provider) {
      return;
    }
    if (
      input.stripeCustomerId &&
      org.stripeCustomerId &&
      org.stripeCustomerId !== input.stripeCustomerId
    ) {
      this.logger.warn(
        `revokeLifetime: stripe customer ${input.stripeCustomerId} does not match org ${org.id}`,
      );
      return;
    }

    await db.organization.update({
      where: { id: org.id },
      data: {
        plan: OrgPlan.FREE,
        planStatus: PlanStatus.CANCELED,
      },
    });
  }

  async activateMonthly(input: {
    organizationId: string;
    currency: BillingCurrency;
    provider: PaymentProvider;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    asaasSubscriptionId?: string | null;
    asaasPaymentId?: string | null;
    currentPeriodEnd?: Date | null;
    tx?: Prisma.TransactionClient;
  }): Promise<MonthlyActivationResult> {
    const db = this.db(input.tx);
    const org = await db.organization.findUnique({
      where: { id: input.organizationId },
    });
    if (!org) {
      this.logger.warn(`activateMonthly: org ${input.organizationId} not found`);
      return SKIPPED_MONTHLY_ACTIVATION;
    }
    // Lifetime is permanent; never allow a later monthly webhook/checkout to downgrade it.
    if (org.plan === OrgPlan.LIFETIME) {
      this.logger.warn(
        `Ignoring monthly activation for org ${input.organizationId}: already on LIFETIME`,
      );
      return SKIPPED_MONTHLY_ACTIVATION;
    }
    if (
      org.paymentProvider &&
      org.paymentProvider !== input.provider &&
      (org.planStatus === PlanStatus.ACTIVE || org.planStatus === PlanStatus.PAST_DUE)
    ) {
      this.logger.warn(
        `Ignoring stale ${input.provider} monthly activation for org ${input.organizationId}`,
      );
      return SKIPPED_MONTHLY_ACTIVATION;
    }
    if (
      input.provider === PaymentProvider.ASAAS &&
      input.asaasSubscriptionId &&
      org.asaasSubscriptionId &&
      org.asaasSubscriptionId !== input.asaasSubscriptionId &&
      (org.planStatus === PlanStatus.ACTIVE || org.planStatus === PlanStatus.PAST_DUE)
    ) {
      this.logger.warn(
        `Ignoring stale Asaas subscription activation for org ${input.organizationId}`,
      );
      return SKIPPED_MONTHLY_ACTIVATION;
    }
    if (input.provider === PaymentProvider.ASAAS && input.asaasPaymentId) {
      if (org.asaasPaymentId === input.asaasPaymentId) {
        this.logger.debug(
          `Ignoring duplicate Asaas PIX activation for org ${input.organizationId}`,
        );
        return SKIPPED_MONTHLY_ACTIVATION;
      }
      if (
        org.asaasPaymentId &&
        org.asaasPaymentId !== input.asaasPaymentId &&
        (org.planStatus === PlanStatus.ACTIVE || org.planStatus === PlanStatus.PAST_DUE)
      ) {
        this.logger.warn(`Ignoring stale Asaas PIX activation for org ${input.organizationId}`);
        return SKIPPED_MONTHLY_ACTIVATION;
      }
    }

    const currentPeriodEnd =
      input.currentPeriodEnd &&
      org.currentPeriodEnd &&
      org.currentPeriodEnd > input.currentPeriodEnd
        ? org.currentPeriodEnd
        : input.currentPeriodEnd;

    const alreadyActiveMonthly =
      org.plan === OrgPlan.STARTER_MONTHLY &&
      (org.planStatus === PlanStatus.ACTIVE || org.planStatus === PlanStatus.PAST_DUE);
    const periodExtended = Boolean(
      input.currentPeriodEnd &&
        (!org.currentPeriodEnd || input.currentPeriodEnd > org.currentPeriodEnd),
    );

    await db.organization.update({
      where: { id: input.organizationId },
      data: {
        plan: OrgPlan.STARTER_MONTHLY,
        planStatus: PlanStatus.ACTIVE,
        planCurrency: input.currency,
        paymentProvider: input.provider,
        ...(input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : {}),
        ...(input.stripeSubscriptionId ? { stripeSubscriptionId: input.stripeSubscriptionId } : {}),
        ...(input.asaasSubscriptionId !== undefined
          ? { asaasSubscriptionId: input.asaasSubscriptionId }
          : {}),
        ...(input.asaasPaymentId !== undefined ? { asaasPaymentId: input.asaasPaymentId } : {}),
        ...(input.currentPeriodEnd !== undefined ? { currentPeriodEnd } : {}),
      },
    });

    return {
      applied: true,
      shouldSendReceipt: !alreadyActiveMonthly || periodExtended,
    };
  }

  async notifyMonthlyPurchased(receipt: MonthlyPlanReceipt): Promise<void> {
    try {
      const recipients = await this.prisma.organizationMember.findMany({
        where: {
          organizationId: receipt.organizationId,
          role: { in: [Role.OWNER, Role.ADMIN] },
        },
        select: {
          user: {
            select: { email: true, name: true, locale: true, anonymizedAt: true },
          },
        },
      });
      const appUrl = (this.config.get<string>('frontendUrl') ?? 'http://localhost:5173').replace(
        /\/$/,
        '',
      );

      for (const member of recipients) {
        const user = member.user;
        if (!user?.email || user.anonymizedAt) continue;
        const content = buildMonthlyPurchasedEmail({
          locale: user.locale === 'en' ? 'en' : 'pt',
          fullName: user.name,
          amountCentavos: receipt.amountCentavos,
          currency: receipt.currency,
          purchasedAt: receipt.purchasedAt,
          periodEnd: receipt.periodEnd,
          paymentMethod: receipt.paymentMethod,
          appUrl,
        });
        await this.mail.send({
          to: user.email,
          subject: content.subject,
          text: content.text,
          html: content.html,
          template: content.template,
        });
      }

      this.logger.log(
        {
          template: 'monthly-purchased',
          organizationId: receipt.organizationId,
          outcome: 'notified',
        },
        'monthly plan email dispatched',
      );
    } catch (err) {
      this.logger.error(
        {
          template: 'monthly-purchased',
          organizationId: receipt.organizationId,
          outcome: 'failed',
          reason: err instanceof Error ? err.message : String(err),
        },
        'monthly plan email failed',
      );
    }
  }

  async syncMonthlyStatus(input: {
    organizationId: string;
    status: PlanStatus;
    provider?: PaymentProvider;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    asaasSubscriptionId?: string | null;
    asaasPaymentId?: string | null;
    currentPeriodEnd?: Date | null;
    tx?: Prisma.TransactionClient;
  }): Promise<void> {
    const db = this.db(input.tx);
    const org = await db.organization.findUnique({
      where: { id: input.organizationId },
    });
    if (!org) {
      this.logger.warn(`syncMonthlyStatus: org ${input.organizationId} not found`);
      return;
    }
    if (org.plan === OrgPlan.LIFETIME) {
      return;
    }
    if (input.provider && org.paymentProvider && org.paymentProvider !== input.provider) {
      return;
    }
    if (
      input.asaasSubscriptionId &&
      org.asaasSubscriptionId &&
      org.asaasSubscriptionId !== input.asaasSubscriptionId
    ) {
      return;
    }
    if (input.asaasPaymentId && org.asaasPaymentId !== input.asaasPaymentId) {
      return;
    }

    const canceled = input.status === PlanStatus.CANCELED || input.status === PlanStatus.INACTIVE;

    await db.organization.update({
      where: { id: org.id },
      data: {
        plan: canceled ? OrgPlan.FREE : OrgPlan.STARTER_MONTHLY,
        planStatus: input.status,
        ...(input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : {}),
        ...(input.stripeSubscriptionId ? { stripeSubscriptionId: input.stripeSubscriptionId } : {}),
        ...(input.asaasSubscriptionId !== undefined
          ? { asaasSubscriptionId: input.asaasSubscriptionId }
          : {}),
        ...(input.asaasPaymentId !== undefined ? { asaasPaymentId: input.asaasPaymentId } : {}),
        ...(input.currentPeriodEnd !== undefined
          ? { currentPeriodEnd: input.currentPeriodEnd }
          : canceled
            ? { currentPeriodEnd: null }
            : {}),
      },
    });
  }

  private db(tx?: Prisma.TransactionClient): BillingDb {
    return tx ?? this.prisma;
  }

  async markInvoicePaid(organizationId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const db = this.db(tx);
    const org = await db.organization.findUnique({ where: { id: organizationId } });
    if (!org || org.plan === OrgPlan.LIFETIME) return;

    await db.organization.update({
      where: { id: org.id },
      data: {
        planStatus: PlanStatus.ACTIVE,
        plan: OrgPlan.STARTER_MONTHLY,
      },
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { OrgPlan, PaymentProvider, PlanStatus, type Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { BillingDb } from './billing-db';
import type { BillingCurrency } from './domain/payment-provider';

@Injectable()
export class BillingActivationService {
  private readonly logger = new Logger(BillingActivationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Activate lifetime entitlement. Returns any prior monthly subscription IDs so
   * callers can cancel the external subscription (activateLifetime clears local IDs).
   */
  async activateLifetime(input: {
    organizationId: string;
    currency: BillingCurrency;
    provider: PaymentProvider;
    stripeCustomerId?: string | null;
    abacateCustomerId?: string | null;
    abacatePaymentId?: string | null;
    tx?: Prisma.TransactionClient;
  }): Promise<{
    previousStripeSubscriptionId: string | null;
    previousAbacateSubscriptionId: string | null;
  }> {
    const db = this.db(input.tx);
    const org = await db.organization.findUnique({
      where: { id: input.organizationId },
    });
    if (!org) {
      this.logger.warn(`activateLifetime: org ${input.organizationId} not found`);
      return {
        previousStripeSubscriptionId: null,
        previousAbacateSubscriptionId: null,
      };
    }

    const previousStripeSubscriptionId = org.stripeSubscriptionId;
    const previousAbacateSubscriptionId = org.abacateSubscriptionId;

    await db.organization.update({
      where: { id: input.organizationId },
      data: {
        plan: OrgPlan.LIFETIME,
        planStatus: PlanStatus.ACTIVE,
        planCurrency: input.currency,
        paymentProvider: input.provider,
        currentPeriodEnd: null,
        stripeSubscriptionId: null,
        abacateSubscriptionId: null,
        ...(input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : {}),
        ...(input.abacateCustomerId ? { abacateCustomerId: input.abacateCustomerId } : {}),
        ...(input.abacatePaymentId ? { abacatePaymentId: input.abacatePaymentId } : {}),
      },
    });

    return { previousStripeSubscriptionId, previousAbacateSubscriptionId };
  }

  /**
   * Revoke a one-time (lifetime) entitlement after refund / payment loss.
   * Only downgrades when the org is still on LIFETIME for the same provider
   * (and matching payment id when available).
   */
  async revokeLifetime(input: {
    organizationId: string;
    provider: PaymentProvider;
    abacatePaymentId?: string | null;
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
      input.abacatePaymentId &&
      org.abacatePaymentId &&
      org.abacatePaymentId !== input.abacatePaymentId
    ) {
      this.logger.warn(
        `revokeLifetime: payment ${input.abacatePaymentId} does not match org ${org.id}`,
      );
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
        ...(input.provider === PaymentProvider.ABACATE ? { abacatePaymentId: null } : {}),
      },
    });
  }

  async activateMonthly(input: {
    organizationId: string;
    currency: BillingCurrency;
    provider: PaymentProvider;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    abacateCustomerId?: string | null;
    abacateSubscriptionId?: string | null;
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
      this.logger.warn(`activateMonthly: org ${input.organizationId} not found`);
      return;
    }
    // Lifetime is permanent; never allow a later monthly webhook/checkout to downgrade it.
    if (org.plan === OrgPlan.LIFETIME) {
      this.logger.warn(
        `Ignoring monthly activation for org ${input.organizationId}: already on LIFETIME`,
      );
      return;
    }
    if (
      org.paymentProvider &&
      org.paymentProvider !== input.provider &&
      (org.planStatus === PlanStatus.ACTIVE || org.planStatus === PlanStatus.PAST_DUE)
    ) {
      this.logger.warn(
        `Ignoring stale ${input.provider} monthly activation for org ${input.organizationId}`,
      );
      return;
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
      return;
    }
    if (input.provider === PaymentProvider.ASAAS && input.asaasPaymentId) {
      if (org.asaasPaymentId === input.asaasPaymentId) {
        this.logger.debug(
          `Ignoring duplicate Asaas PIX activation for org ${input.organizationId}`,
        );
        return;
      }
      if (
        org.asaasPaymentId &&
        org.asaasPaymentId !== input.asaasPaymentId &&
        (org.planStatus === PlanStatus.ACTIVE || org.planStatus === PlanStatus.PAST_DUE)
      ) {
        this.logger.warn(`Ignoring stale Asaas PIX activation for org ${input.organizationId}`);
        return;
      }
    }

    const currentPeriodEnd =
      input.currentPeriodEnd &&
      org.currentPeriodEnd &&
      org.currentPeriodEnd > input.currentPeriodEnd
        ? org.currentPeriodEnd
        : input.currentPeriodEnd;

    await db.organization.update({
      where: { id: input.organizationId },
      data: {
        plan: OrgPlan.STARTER_MONTHLY,
        planStatus: PlanStatus.ACTIVE,
        planCurrency: input.currency,
        paymentProvider: input.provider,
        ...(input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : {}),
        ...(input.stripeSubscriptionId ? { stripeSubscriptionId: input.stripeSubscriptionId } : {}),
        ...(input.abacateCustomerId ? { abacateCustomerId: input.abacateCustomerId } : {}),
        ...(input.abacateSubscriptionId !== undefined
          ? { abacateSubscriptionId: input.abacateSubscriptionId }
          : {}),
        ...(input.asaasSubscriptionId !== undefined
          ? { asaasSubscriptionId: input.asaasSubscriptionId }
          : {}),
        ...(input.asaasPaymentId !== undefined ? { asaasPaymentId: input.asaasPaymentId } : {}),
        ...(input.currentPeriodEnd !== undefined ? { currentPeriodEnd } : {}),
      },
    });
  }

  async syncMonthlyStatus(input: {
    organizationId: string;
    status: PlanStatus;
    provider?: PaymentProvider;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    abacateCustomerId?: string | null;
    abacateSubscriptionId?: string | null;
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
        ...(input.abacateCustomerId ? { abacateCustomerId: input.abacateCustomerId } : {}),
        ...(input.abacateSubscriptionId !== undefined
          ? { abacateSubscriptionId: input.abacateSubscriptionId }
          : {}),
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

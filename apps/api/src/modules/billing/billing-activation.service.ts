import { Injectable, Logger } from '@nestjs/common';
import { OrgPlan, PaymentProvider, PlanStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
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
  }): Promise<{
    previousStripeSubscriptionId: string | null;
    previousAbacateSubscriptionId: string | null;
  }> {
    const org = await this.prisma.organization.findUnique({
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

    await this.prisma.organization.update({
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
  }): Promise<void> {
    const org = await this.prisma.organization.findUnique({
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

    await this.prisma.organization.update({
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
    /** Pass null to clear a stale card subscription id (e.g. PIX month after card). */
    abacateSubscriptionId?: string | null;
    currentPeriodEnd?: Date | null;
  }): Promise<void> {
    const org = await this.prisma.organization.findUnique({
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

    await this.prisma.organization.update({
      where: { id: input.organizationId },
      data: {
        plan: OrgPlan.STARTER_MONTHLY,
        planStatus: PlanStatus.ACTIVE,
        planCurrency: input.currency,
        paymentProvider: input.provider,
        ...(input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : {}),
        ...(input.stripeSubscriptionId
          ? { stripeSubscriptionId: input.stripeSubscriptionId }
          : {}),
        ...(input.abacateCustomerId ? { abacateCustomerId: input.abacateCustomerId } : {}),
        // undefined = leave unchanged; null/string = write (truthy spread cannot clear).
        ...(input.abacateSubscriptionId !== undefined
          ? { abacateSubscriptionId: input.abacateSubscriptionId }
          : {}),
        ...(input.currentPeriodEnd !== undefined
          ? { currentPeriodEnd: input.currentPeriodEnd }
          : {}),
      },
    });
  }

  async syncMonthlyStatus(input: {
    organizationId: string;
    status: PlanStatus;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    abacateCustomerId?: string | null;
    abacateSubscriptionId?: string | null;
    currentPeriodEnd?: Date | null;
  }): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
    });
    if (!org) {
      this.logger.warn(`syncMonthlyStatus: org ${input.organizationId} not found`);
      return;
    }
    if (org.plan === OrgPlan.LIFETIME) {
      return;
    }

    const canceled = input.status === PlanStatus.CANCELED || input.status === PlanStatus.INACTIVE;

    await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        plan: canceled ? OrgPlan.FREE : OrgPlan.STARTER_MONTHLY,
        planStatus: input.status,
        ...(input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : {}),
        ...(input.stripeSubscriptionId
          ? { stripeSubscriptionId: input.stripeSubscriptionId }
          : {}),
        ...(input.abacateCustomerId ? { abacateCustomerId: input.abacateCustomerId } : {}),
        ...(input.abacateSubscriptionId
          ? { abacateSubscriptionId: input.abacateSubscriptionId }
          : {}),
        ...(input.currentPeriodEnd !== undefined
          ? { currentPeriodEnd: input.currentPeriodEnd }
          : canceled
            ? { currentPeriodEnd: null }
            : {}),
      },
    });
  }

  async markInvoicePaid(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org || org.plan === OrgPlan.LIFETIME) return;

    await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        planStatus: PlanStatus.ACTIVE,
        plan: OrgPlan.STARTER_MONTHLY,
      },
    });
  }
}

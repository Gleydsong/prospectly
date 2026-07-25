import { Injectable, Logger } from '@nestjs/common';
import { OrgPlan, PaymentProvider, PlanStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { BillingCurrency, BillingInterval } from './domain/payment-provider';

@Injectable()
export class BillingActivationService {
  private readonly logger = new Logger(BillingActivationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async activateLifetime(input: {
    organizationId: string;
    currency: BillingCurrency;
    provider: PaymentProvider;
    stripeCustomerId?: string | null;
    abacateCustomerId?: string | null;
    abacatePaymentId?: string | null;
  }): Promise<void> {
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
  }

  async activateMonthly(input: {
    organizationId: string;
    currency: BillingCurrency;
    provider: PaymentProvider;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    abacateCustomerId?: string | null;
    abacateSubscriptionId?: string | null;
    currentPeriodEnd?: Date | null;
  }): Promise<void> {
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
        ...(input.abacateSubscriptionId
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

  async bindCheckoutIntent(input: {
    organizationId: string;
    provider: PaymentProvider;
    interval: BillingInterval;
    abacatePaymentId?: string | null;
    abacateCustomerId?: string | null;
    stripeCustomerId?: string | null;
  }): Promise<void> {
    await this.prisma.organization.update({
      where: { id: input.organizationId },
      data: {
        paymentProvider: input.provider,
        ...(input.abacatePaymentId ? { abacatePaymentId: input.abacatePaymentId } : {}),
        ...(input.abacateCustomerId ? { abacateCustomerId: input.abacateCustomerId } : {}),
        ...(input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : {}),
      },
    });
  }
}

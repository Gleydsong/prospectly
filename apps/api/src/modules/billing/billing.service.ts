import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import crypto from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { OrgPlan, PaymentProvider, PlanStatus, type Organization } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingActivationService } from './billing-activation.service';
import { CreditPurchaseService } from './credit-purchase.service';
import { CREDIT_PACKAGES } from './credit-purchase.constants';
import { CREDIT_COSTS, FREE_SEARCH_LIMIT } from './billing.constants';
import type {
  BillingCurrency,
  BillingInterval,
  CreditOffer,
  CheckoutResult,
  PaymentMethod,
  PaymentProviderId,
} from './domain/payment-provider';
import { resolvePaymentProviderId } from './domain/payment-router';
import { AbacatePaymentProvider } from './infrastructure/abacate.payment-provider';
import { StripePaymentProvider } from './infrastructure/stripe.payment-provider';

export interface SearchUsageSnapshot {
  used: number;
  /** null when the active plan has no search cap. */
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly activation: BillingActivationService,
    private readonly stripeProvider: StripePaymentProvider,
    private readonly abacateProvider: AbacatePaymentProvider,
    private readonly creditPurchases: CreditPurchaseService,
  ) {}

  async getOrganizationBilling(organizationId: string) {
    const org = await this.requireOrg(organizationId);
    const provider = org.paymentProvider;
    const searchUsage = await this.getSearchUsage(org);
    return {
      searchUsage,
      plan: org.plan,
      planStatus: org.planStatus,
      planCurrency: org.planCurrency,
      paymentProvider: provider,
      currentPeriodEnd: org.currentPeriodEnd,
      hasStripeCustomer: Boolean(org.stripeCustomerId),
      canOpenPortal: provider === PaymentProvider.STRIPE && Boolean(org.stripeCustomerId),
      canCancelSubscription:
        org.plan === OrgPlan.STARTER_MONTHLY &&
        org.planStatus === PlanStatus.ACTIVE &&
        ((provider === PaymentProvider.STRIPE && Boolean(org.stripeSubscriptionId)) ||
          (provider === PaymentProvider.ABACATE && Boolean(org.abacateSubscriptionId))),
      freeSearchLimit: FREE_SEARCH_LIMIT,
      creditBalance: org.creditBalance ?? 0,
    };
  }

  async getSearchUsage(
    organization: Organization | string,
  ): Promise<SearchUsageSnapshot> {
    const org =
      typeof organization === 'string' ? await this.requireOrg(organization) : organization;
    const used = await this.countBillableRuns(org.id);
    const creditBalance = org.creditBalance ?? 0;
    const creditEquivalent = Math.floor(creditBalance / CREDIT_COSTS.mapsSearch);
    const limit = org.planStatus === PlanStatus.ACTIVE ? null : FREE_SEARCH_LIMIT + creditEquivalent;
    return {
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      unlimited: limit === null,
    };
  }

  async assertCanCreateSearch(
    organizationId: string,
    requiredCredits = CREDIT_COSTS.mapsSearch,
  ): Promise<void> {
    const org = await this.requireOrg(organizationId);
    if (org.planStatus === PlanStatus.ACTIVE) {
      return;
    }

    const searchCount = await this.countBillableRuns(organizationId);
    const creditBalance = org.creditBalance ?? 0;
    if (searchCount >= FREE_SEARCH_LIMIT && creditBalance < requiredCredits) {
      throw new ForbiddenException({
        code: 'ENTITLEMENT_SEARCHES',
        message: `Free plan allows ${FREE_SEARCH_LIMIT} searches. Upgrade to continue.`,
        requiredPlan: OrgPlan.STARTER_MONTHLY,
        usage: searchCount,
        limit: FREE_SEARCH_LIMIT,
      });
    }
  }

  async consumeCreditForSearch(organizationId: string, searchId: string): Promise<void> {
    await this.consumeCredits({
      organizationId,
      amount: CREDIT_COSTS.mapsSearch,
      reason: 'SEARCH_CONSUME',
      idempotencyKey: `search-consume:${searchId}`,
      searchId,
      usesFreeQuota: true,
    });
  }

  async consumeCreditForOpportunityRun(organizationId: string, runId: string): Promise<void> {
    await this.consumeCredits({
      organizationId,
      amount: CREDIT_COSTS.opportunityFinder,
      reason: 'AI_CONSUME',
      idempotencyKey: `opportunity-consume:${runId}`,
      opportunityRunId: runId,
      metadata: { feature: 'AI_OPPORTUNITY_FINDER' },
      usesFreeQuota: true,
    });
  }

  async consumeCreditForExplain(
    organizationId: string,
    candidateId: string,
    opportunityRunId: string,
  ): Promise<void> {
    await this.consumeCredits({
      organizationId,
      amount: CREDIT_COSTS.explain,
      reason: 'AI_CONSUME',
      idempotencyKey: `explain-consume:${candidateId}`,
      opportunityRunId,
      metadata: { feature: 'EXPLAIN', candidateId },
    });
  }

  async consumeCreditForSaveLead(
    organizationId: string,
    candidateId: string,
    opportunityRunId: string,
  ): Promise<void> {
    await this.consumeCredits({
      organizationId,
      amount: CREDIT_COSTS.saveLead,
      reason: 'AI_CONSUME',
      idempotencyKey: `save-lead-consume:${candidateId}`,
      opportunityRunId,
      metadata: { feature: 'SAVE_LEAD', candidateId },
    });
  }

  async refundSearchCredit(
    organizationId: string,
    searchId: string,
    cause = 'SEARCH_FAILED',
  ): Promise<void> {
    await this.refundConsumedCredits({
      organizationId,
      consumeKey: `search-consume:${searchId}`,
      refundKey: `search-refund:${searchId}`,
      searchId,
      metadata: { cause },
    });
  }

  async refundOpportunityRunCredit(
    organizationId: string,
    runId: string,
    cause = 'QUEUE_DISPATCH_FAILED',
  ): Promise<void> {
    await this.refundConsumedCredits({
      organizationId,
      consumeKey: `opportunity-consume:${runId}`,
      refundKey: `opportunity-refund:${runId}`,
      opportunityRunId: runId,
      metadata: { feature: 'AI_OPPORTUNITY_FINDER', cause },
    });
  }

  async refundExplainCredit(organizationId: string, candidateId: string): Promise<void> {
    await this.refundConsumedCredits({
      organizationId,
      consumeKey: `explain-consume:${candidateId}`,
      refundKey: `explain-refund:${candidateId}`,
      metadata: { feature: 'EXPLAIN', candidateId, cause: 'EXPLAIN_FAILED' },
    });
  }

  async refundSaveLeadCredit(organizationId: string, candidateId: string): Promise<void> {
    await this.refundConsumedCredits({
      organizationId,
      consumeKey: `save-lead-consume:${candidateId}`,
      refundKey: `save-lead-refund:${candidateId}`,
      metadata: { feature: 'SAVE_LEAD', candidateId, cause: 'SAVE_LEAD_FAILED' },
    });
  }

  async createCheckoutSession(
    organizationId: string,
    userEmail: string,
    interval: BillingInterval,
    currency: BillingCurrency,
    paymentMethod: PaymentMethod,
  ): Promise<CheckoutResult> {
    if (currency !== 'BRL') {
      throw new BadRequestException('Only BRL billing is supported');
    }
    const org = await this.requireOrg(organizationId);
    if (org.plan === OrgPlan.LIFETIME && org.planStatus === PlanStatus.ACTIVE) {
      throw new BadRequestException(
        'Organization already has an active lifetime plan. Further checkouts are not allowed.',
      );
    }
    const providerId = resolvePaymentProviderId(paymentMethod);
    this.assertPlanProviderCompatible(org, providerId);

    const provider =
      providerId === 'ABACATE' ? this.abacateProvider : this.stripeProvider;

    const frontendUrl = this.config.get<string>('frontendUrl') ?? 'http://localhost:5173';
    const successUrl =
      providerId === 'ABACATE'
        ? (this.config.get<string>('abacate.successUrl') ??
          `${frontendUrl}/billing/success`)
        : (this.config.get<string>('stripe.successUrl') ??
          `${frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`);
    const cancelUrl =
      providerId === 'ABACATE'
        ? (this.config.get<string>('abacate.cancelUrl') ?? `${frontendUrl}/billing/cancel`)
        : (this.config.get<string>('stripe.cancelUrl') ?? `${frontendUrl}/billing/cancel`);

    const existingCustomerId =
      providerId === 'ABACATE' ? org.abacateCustomerId : org.stripeCustomerId;

    const result = await provider.createCheckout({
      organizationId,
      customerEmail: userEmail,
      customerName: org.name,
      interval,
      currency: 'BRL',
      successUrl,
      cancelUrl,
      existingCustomerId,
    });

    await this.activation.bindCheckoutIntent({
      organizationId,
      provider: providerId === 'ABACATE' ? PaymentProvider.ABACATE : PaymentProvider.STRIPE,
      interval,
      abacatePaymentId: result.mode === 'pix' ? result.externalPaymentId : undefined,
      abacateCustomerId:
        result.mode === 'redirect' && result.provider === 'ABACATE'
          ? result.externalCustomerId
          : undefined,
      stripeCustomerId:
        result.mode === 'redirect' && result.provider === 'STRIPE'
          ? result.externalCustomerId
          : undefined,
    });

    return result;
  }

  async createCreditCheckoutSession(
    organizationId: string,
    offer: CreditOffer,
    paymentMethod: PaymentMethod,
  ): Promise<CheckoutResult> {
    await this.requireOrg(organizationId);
    const pack = CREDIT_PACKAGES[offer];
    if (!pack) throw new BadRequestException('Invalid credit offer');

    const providerId = resolvePaymentProviderId(paymentMethod);
    const externalId = `org:${organizationId}:credits:${crypto.randomUUID()}`;
    const purchase = await this.creditPurchases.createPending({
      organizationId,
      offer,
      externalId,
      provider: providerId === 'ABACATE' ? PaymentProvider.ABACATE : PaymentProvider.STRIPE,
    });
    const frontendUrl = this.config.get<string>('frontendUrl') ?? 'http://localhost:5173';
    const successUrl = `${frontendUrl}/billing/success`;
    const cancelUrl = `${frontendUrl}/billing/cancel`;
    try {
      if (providerId === 'ABACATE') {
        return await this.abacateProvider.createCreditCheckout({
          organizationId,
          offer,
          purchaseId: purchase.id,
          externalId,
          successUrl,
          cancelUrl,
        });
      }
      return await this.stripeProvider.createCreditCheckout({
        organizationId,
        offer,
        purchaseId: purchase.id,
        externalId,
        successUrl,
        cancelUrl,
      });
    } catch (error) {
      await this.prisma.creditPurchase.update({
        where: { id: purchase.id },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }

  async createPortalSession(organizationId: string): Promise<{ url: string }> {
    const org = await this.requireOrg(organizationId);
    if (org.paymentProvider === PaymentProvider.ABACATE) {
      throw new BadRequestException(
        'Customer portal is only available for Stripe card subscriptions. Cancel PIX plans via the cancel endpoint.',
      );
    }
    if (!org.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer for this organization');
    }

    const returnUrl =
      this.config.get<string>('stripe.portalReturnUrl') ??
      `${this.config.get<string>('frontendUrl')}/credits`;

    return this.stripeProvider.createPortal({
      organizationId,
      externalCustomerId: org.stripeCustomerId,
      returnUrl,
    });
  }

  async cancelSubscription(organizationId: string): Promise<{ canceled: true }> {
    const org = await this.requireOrg(organizationId);
    if (org.plan !== OrgPlan.STARTER_MONTHLY) {
      throw new BadRequestException('Only monthly subscriptions can be canceled');
    }

    if (org.paymentProvider === PaymentProvider.ABACATE) {
      if (org.abacateSubscriptionId) {
        await this.abacateProvider.cancelSubscription({
          organizationId,
          externalSubscriptionId: org.abacateSubscriptionId,
        });
        return { canceled: true };
      }
      // PIX monthly (transparent, no recurring subscription id): cancel locally.
      await this.activation.syncMonthlyStatus({
        organizationId,
        status: PlanStatus.CANCELED,
      });
      return { canceled: true };
    }

    if (!org.stripeSubscriptionId) {
      throw new BadRequestException('No Stripe subscription for this organization');
    }

    throw new BadRequestException(
      'Cancel Stripe subscriptions via the customer portal',
    );
  }

  async handleStripeWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: true }> {
    const parsed = await this.stripeProvider.verifyAndParseWebhook(rawBody, headers);
    const firstTime = await this.claimWebhookEvent('STRIPE', parsed.eventId, parsed.type);
    if (!firstTime) {
      return { received: true };
    }
    try {
      await this.stripeProvider.applyWebhookEvent(parsed.payload, parsed.type);
    } catch (error) {
      // Release the claim so provider retries can re-process after a transient failure.
      await this.releaseWebhookEvent('STRIPE', parsed.eventId);
      throw error;
    }
    return { received: true };
  }

  /** @deprecated Prefer handleStripeWebhook — alias kept one release. */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<{ received: true }> {
    return this.handleStripeWebhook(rawBody, { 'stripe-signature': signature });
  }

  async handleAbacateWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, string | string[] | undefined>,
  ): Promise<{ received: true }> {
    const parsed = await this.abacateProvider.verifyAndParseWebhook(rawBody, headers, query);
    const firstTime = await this.claimWebhookEvent('ABACATE', parsed.eventId, parsed.type);
    if (!firstTime) {
      return { received: true };
    }
    try {
      await this.abacateProvider.applyWebhookEvent(parsed.payload, parsed.type);
    } catch (error) {
      await this.releaseWebhookEvent('ABACATE', parsed.eventId);
      throw error;
    }
    return { received: true };
  }

  private assertPlanProviderCompatible(org: Organization, next: PaymentProviderId): void {
    if (!org.paymentProvider) return;
    if (org.paymentProvider === next) return;
    if (org.planStatus === PlanStatus.ACTIVE) {
      throw new ForbiddenException(
        'Organization already has an active plan on another payment provider. Gateway migration is not supported.',
      );
    }
    throw new ForbiddenException(
      'Organization is bound to another payment provider for plans. Use the same payment method as the existing gateway.',
    );
  }

  private async claimWebhookEvent(
    provider: PaymentProviderId,
    eventId: string,
    type: string,
  ): Promise<boolean> {
    try {
      await this.prisma.billingWebhookEvent.create({
        data: {
          provider: provider === 'ABACATE' ? PaymentProvider.ABACATE : PaymentProvider.STRIPE,
          eventId,
          type,
        },
      });
      return true;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        this.logger.debug(`Ignoring duplicate ${provider} webhook event ${eventId}`);
        return false;
      }
      throw error;
    }
  }

  private async releaseWebhookEvent(
    provider: PaymentProviderId,
    eventId: string,
  ): Promise<void> {
    try {
      await this.prisma.billingWebhookEvent.delete({
        where: {
          provider_eventId: {
            provider: provider === 'ABACATE' ? PaymentProvider.ABACATE : PaymentProvider.STRIPE,
            eventId,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to release ${provider} webhook claim ${eventId}: ${(error as Error).message}`,
      );
    }
  }

  private async countBillableRuns(organizationId: string): Promise<number> {
    const [searches, opportunityRuns] = await Promise.all([
      this.prisma.search.count({ where: { organizationId } }),
      this.prisma.opportunityRun.count({ where: { organizationId } }),
    ]);
    return searches + opportunityRuns;
  }

  private async consumeCredits(params: {
    organizationId: string;
    amount: number;
    reason: 'SEARCH_CONSUME' | 'AI_CONSUME';
    idempotencyKey: string;
    searchId?: string;
    opportunityRunId?: string;
    metadata?: Record<string, string>;
    usesFreeQuota?: boolean;
  }): Promise<void> {
    const org = await this.requireOrg(params.organizationId);
    if (org.planStatus === PlanStatus.ACTIVE) return;

    if (params.usesFreeQuota) {
      const used = await this.countBillableRuns(params.organizationId);
      if (used <= FREE_SEARCH_LIMIT) return;
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.creditLedgerEntry.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId: params.organizationId,
            idempotencyKey: params.idempotencyKey,
          },
        },
      });
      if (existing) return;

      const consumed = await tx.organization.updateMany({
        where: { id: params.organizationId, creditBalance: { gte: params.amount } },
        data: { creditBalance: { decrement: params.amount } },
      });
      if (consumed.count !== 1) {
        throw new ForbiddenException({
          code: 'ENTITLEMENT_CREDITS',
          message: 'No credits remaining. Purchase a credit package to continue.',
        });
      }

      const updated = await tx.organization.findFirstOrThrow({
        where: { id: params.organizationId },
        select: { creditBalance: true },
      });

      await tx.creditLedgerEntry.create({
        data: {
          organizationId: params.organizationId,
          reason: params.reason,
          delta: -params.amount,
          balanceAfter: updated.creditBalance,
          idempotencyKey: params.idempotencyKey,
          ...(params.searchId ? { searchId: params.searchId } : {}),
          ...(params.opportunityRunId ? { opportunityRunId: params.opportunityRunId } : {}),
          ...(params.metadata ? { metadata: params.metadata } : {}),
        },
      });
    });
  }

  private async refundConsumedCredits(params: {
    organizationId: string;
    consumeKey: string;
    refundKey: string;
    searchId?: string;
    opportunityRunId?: string;
    metadata?: Record<string, string>;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const [consume, existingRefund] = await Promise.all([
        tx.creditLedgerEntry.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId: params.organizationId,
              idempotencyKey: params.consumeKey,
            },
          },
        }),
        tx.creditLedgerEntry.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId: params.organizationId,
              idempotencyKey: params.refundKey,
            },
          },
        }),
      ]);
      if (!consume || existingRefund) return;

      const updated = await tx.organization.update({
        where: { id: params.organizationId },
        data: { creditBalance: { increment: Math.abs(consume.delta) } },
        select: { creditBalance: true },
      });
      await tx.creditLedgerEntry.create({
        data: {
          organizationId: params.organizationId,
          reason: 'REFUND',
          delta: Math.abs(consume.delta),
          balanceAfter: updated.creditBalance,
          idempotencyKey: params.refundKey,
          ...(params.searchId ? { searchId: params.searchId } : {}),
          ...(params.opportunityRunId ? { opportunityRunId: params.opportunityRunId } : {}),
          ...(params.metadata ? { metadata: params.metadata } : {}),
        },
      });
    });
  }

  private async requireOrg(organizationId: string): Promise<Organization> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });
    if (!org) {
      throw new BadRequestException('Organization not found');
    }
    return org;
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}

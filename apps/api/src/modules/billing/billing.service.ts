import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import crypto from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { OrgPlan, PaymentProvider, PlanStatus, BillingWebhookEventStatus, type Organization, type Role } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingActivationService } from './billing-activation.service';
import { CreditPurchaseService } from './credit-purchase.service';
import { CREDIT_PACKAGES } from './credit-purchase.constants';
import { CREDIT_COSTS, FREE_SEARCH_LIMIT } from './billing.constants';
import { hasUnlimitedAccess, isMonthlyPeriodExpired } from './domain/plan-access';
import { EntitlementService } from './entitlement.service';
import type {
  BillingCurrency,
  BillingInterval,
  CreditOffer,
  CheckoutResult,
  PaymentMethod,
} from './domain/payment-provider';
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
    private readonly entitlements: EntitlementService,
  ) {}

  async getOrganizationBilling(organizationId: string, role?: Role) {
    const org = await this.hydrateOrg(organizationId);
    const provider = org.paymentProvider;
    const searchUsage = await this.getSearchUsage(org);
    const canManage = role === 'OWNER' || role === 'ADMIN';
    const unlimited = hasUnlimitedAccess(org);
    return {
      searchUsage,
      plan: org.plan,
      planStatus: org.planStatus,
      planCurrency: org.planCurrency,
      paymentProvider: provider,
      currentPeriodEnd: org.currentPeriodEnd,
      legacyStripeSubscription: canManage
        ? provider === PaymentProvider.STRIPE && Boolean(org.stripeCustomerId)
        : false,
      canOpenPortal: canManage
        ? provider === PaymentProvider.STRIPE && Boolean(org.stripeCustomerId)
        : false,
      canCancelSubscription: canManage
        ? org.plan === OrgPlan.STARTER_MONTHLY &&
          unlimited &&
          provider === PaymentProvider.ABACATE
        : false,
      canExportCsv: await this.entitlements.canExportCsv(organizationId),
      freeSearchLimit: FREE_SEARCH_LIMIT,
      creditBalance: org.creditBalance ?? 0,
      monthlyCardEnabled: this.hasConfiguredProduct('abacate.productMonthlyBrl'),
    };
  }

  private hasConfiguredProduct(configKey: string): boolean {
    const value = this.config.get<string>(configKey);
    return typeof value === 'string' && value.trim().length > 0;
  }

  async getSearchUsage(
    organization: Organization | string,
  ): Promise<SearchUsageSnapshot> {
    const org =
      typeof organization === 'string' ? await this.requireOrg(organization) : organization;
    const used = await this.countBillableRuns(org.id);
    const creditBalance = org.creditBalance ?? 0;
    const creditEquivalent = Math.floor(creditBalance / CREDIT_COSTS.mapsSearch);
    const limit = hasUnlimitedAccess(org) ? null : FREE_SEARCH_LIMIT + creditEquivalent;
    return {
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      unlimited: limit === null,
    };
  }

  async assertCanCreateSearch(
    organizationId: string,
    requiredCredits: number = CREDIT_COSTS.mapsSearch,
  ): Promise<void> {
    const org = await this.hydrateOrg(organizationId);
    if (hasUnlimitedAccess(org)) {
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
      refundIdempotencyKey: `search-refund:${searchId}`,
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
      refundIdempotencyKey: `opportunity-refund:${runId}`,
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
      refundIdempotencyKey: `explain-refund:${candidateId}`,
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
      refundIdempotencyKey: `save-lead-refund:${candidateId}`,
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
    if (interval === 'lifetime') {
      throw new BadRequestException(
        'Lifetime checkout is no longer available. Buy credits or subscribe monthly.',
      );
    }
    const org = await this.requireOrg(organizationId);
    if (org.plan === OrgPlan.LIFETIME && org.planStatus === PlanStatus.ACTIVE) {
      throw new BadRequestException(
        'Organization already has an active lifetime plan. Further checkouts are not allowed.',
      );
    }
    this.assertCanStartAbacatePlanCheckout(org);

    const frontendUrl = this.config.get<string>('frontendUrl') ?? 'http://localhost:5173';
    const successUrl =
      this.config.get<string>('abacate.successUrl') ?? `${frontendUrl}/billing/success`;
    const cancelUrl =
      this.config.get<string>('abacate.cancelUrl') ?? `${frontendUrl}/billing/cancel`;

    return this.abacateProvider.createCheckout({
      organizationId,
      customerEmail: userEmail,
      customerName: org.name,
      interval,
      currency: 'BRL',
      paymentMethod,
      successUrl,
      cancelUrl,
      existingCustomerId: org.abacateCustomerId,
    });
  }

  async createCreditCheckoutSession(
    organizationId: string,
    offer: CreditOffer,
    paymentMethod: PaymentMethod,
  ): Promise<CheckoutResult> {
    await this.requireOrg(organizationId);
    const pack = CREDIT_PACKAGES[offer];
    if (!pack) throw new BadRequestException('Invalid credit offer');

    const externalId = `org:${organizationId}:credits:${crypto.randomUUID()}`;
    const purchase = await this.creditPurchases.createPending({
      organizationId,
      offer,
      externalId,
      provider: PaymentProvider.ABACATE,
      paymentMethod,
    });
    const frontendUrl = this.config.get<string>('frontendUrl') ?? 'http://localhost:5173';
    const successUrl = `${frontendUrl}/billing/success`;
    const cancelUrl = `${frontendUrl}/billing/cancel`;
    try {
      return await this.abacateProvider.createCreditCheckout({
        organizationId,
        offer,
        paymentMethod,
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
    if (org.paymentProvider !== PaymentProvider.STRIPE) {
      throw new BadRequestException(
        'Customer portal is only available for legacy Stripe subscriptions.',
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
    const claimed = await this.claimWebhookEvent('STRIPE', parsed.eventId, parsed.type);
    if (!claimed) {
      return { received: true };
    }
    try {
      await this.stripeProvider.applyWebhookEvent(parsed.payload, parsed.type);
      await this.markWebhookProcessed('STRIPE', parsed.eventId);
    } catch (error) {
      await this.markWebhookFailed('STRIPE', parsed.eventId, error);
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
    const claimed = await this.claimWebhookEvent('ABACATE', parsed.eventId, parsed.type);
    if (!claimed) {
      return { received: true };
    }
    try {
      await this.abacateProvider.applyWebhookEvent(parsed.payload, parsed.type);
      await this.markWebhookProcessed('ABACATE', parsed.eventId);
    } catch (error) {
      await this.markWebhookFailed('ABACATE', parsed.eventId, error);
      throw error;
    }
    return { received: true };
  }

  private assertCanStartAbacatePlanCheckout(org: Organization): void {
    if (org.paymentProvider !== PaymentProvider.STRIPE) return;
    if (org.planStatus === PlanStatus.ACTIVE || org.planStatus === PlanStatus.PAST_DUE) {
      throw new ForbiddenException(
        'Organization already has an active Stripe subscription. Cancel it via the customer portal before starting an AbacatePay plan.',
      );
    }
  }

  private prismaProvider(provider: 'STRIPE' | 'ABACATE'): PaymentProvider {
    return provider === 'ABACATE' ? PaymentProvider.ABACATE : PaymentProvider.STRIPE;
  }

  private async claimWebhookEvent(
    provider: 'STRIPE' | 'ABACATE',
    eventId: string,
    type: string,
  ): Promise<boolean> {
    const prismaProvider = this.prismaProvider(provider);
    const existing = await this.prisma.billingWebhookEvent.findUnique({
      where: { provider_eventId: { provider: prismaProvider, eventId } },
    });
    if (existing) {
      return this.reclaimWebhookEvent(existing, prismaProvider, eventId);
    }
    try {
      await this.prisma.billingWebhookEvent.create({
        data: {
          provider: prismaProvider,
          eventId,
          type,
          status: BillingWebhookEventStatus.PROCESSING,
          attempts: 1,
        },
      });
      return true;
    } catch (error) {
      if (!this.isUniqueConstraintViolation(error)) throw error;
      const raced = await this.prisma.billingWebhookEvent.findUnique({
        where: { provider_eventId: { provider: prismaProvider, eventId } },
      });
      if (!raced) {
        this.logger.debug(`Ignoring duplicate ${provider} webhook event ${eventId}`);
        return false;
      }
      return this.reclaimWebhookEvent(raced, prismaProvider, eventId);
    }
  }

  private async reclaimWebhookEvent(
    existing: { status: BillingWebhookEventStatus; updatedAt: Date; attempts: number },
    provider: PaymentProvider,
    eventId: string,
  ): Promise<boolean> {
    if (existing.status === BillingWebhookEventStatus.PROCESSED) {
      this.logger.debug(`Ignoring duplicate ${provider} webhook event ${eventId}`);
      return false;
    }
    const staleMs = 2 * 60 * 1000;
    const stale =
      existing.status === BillingWebhookEventStatus.PROCESSING &&
      Date.now() - existing.updatedAt.getTime() > staleMs;
    if (existing.status === BillingWebhookEventStatus.PROCESSING && !stale) {
      this.logger.debug(`Ignoring in-flight ${provider} webhook event ${eventId}`);
      return false;
    }
    await this.prisma.billingWebhookEvent.update({
      where: { provider_eventId: { provider, eventId } },
      data: {
        status: BillingWebhookEventStatus.PROCESSING,
        attempts: { increment: 1 },
        lastError: null,
        failedAt: null,
      },
    });
    return true;
  }

  private async markWebhookProcessed(
    provider: 'STRIPE' | 'ABACATE',
    eventId: string,
  ): Promise<void> {
    await this.prisma.billingWebhookEvent.update({
      where: {
        provider_eventId: { provider: this.prismaProvider(provider), eventId },
      },
      data: {
        status: BillingWebhookEventStatus.PROCESSED,
        processedAt: new Date(),
        lastError: null,
      },
    });
  }

  private async markWebhookFailed(
    provider: 'STRIPE' | 'ABACATE',
    eventId: string,
    error: unknown,
  ): Promise<void> {
    const lastError = this.sanitizeWebhookError(error);
    try {
      await this.prisma.billingWebhookEvent.update({
        where: {
          provider_eventId: { provider: this.prismaProvider(provider), eventId },
        },
        data: {
          status: BillingWebhookEventStatus.FAILED,
          lastError,
          failedAt: new Date(),
        },
      });
    } catch (updateError) {
      this.logger.error(
        `Failed to mark ${provider} webhook ${eventId} as FAILED: ${(updateError as Error).message}`,
      );
    }
  }

  private sanitizeWebhookError(error: unknown): string {
    const message = error instanceof Error ? error.message : 'processing_failed';
    return message.replace(/Bearer\s+\S+/gi, '[redacted]').slice(0, 500);
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
    /** Paired refund key — when present, a prior refund allows a fresh debit. */
    refundIdempotencyKey?: string;
    searchId?: string;
    opportunityRunId?: string;
    metadata?: Record<string, string>;
    usesFreeQuota?: boolean;
  }): Promise<void> {
    const org = await this.requireOrg(params.organizationId);
    if (hasUnlimitedAccess(org)) return;

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
      if (existing) {
        const refund = params.refundIdempotencyKey
          ? await tx.creditLedgerEntry.findUnique({
              where: {
                organizationId_idempotencyKey: {
                  organizationId: params.organizationId,
                  idempotencyKey: params.refundIdempotencyKey,
                },
              },
            })
          : null;
        // Refunded consume left the original key in place — drop it so retry can debit again.
        if (refund && refund.createdAt >= existing.createdAt) {
          await tx.creditLedgerEntry.delete({ where: { id: existing.id } });
        } else {
          return;
        }
      }

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
      if (!consume) return;
      // Same consume already refunded (refund row is at/after this consume).
      if (existingRefund && existingRefund.createdAt >= consume.createdAt) return;

      const updated = await tx.organization.update({
        where: { id: params.organizationId },
        data: { creditBalance: { increment: Math.abs(consume.delta) } },
        select: { creditBalance: true },
      });

      // Free the consume idempotency key so a later retry can debit again.
      await tx.creditLedgerEntry.delete({ where: { id: consume.id } });

      if (existingRefund) {
        // Prior cycle's refund — replace with this cycle's restoration.
        await tx.creditLedgerEntry.update({
          where: { id: existingRefund.id },
          data: {
            delta: Math.abs(consume.delta),
            balanceAfter: updated.creditBalance,
            ...(params.searchId ? { searchId: params.searchId } : {}),
            ...(params.opportunityRunId ? { opportunityRunId: params.opportunityRunId } : {}),
            ...(params.metadata ? { metadata: params.metadata } : {}),
          },
        });
        return;
      }

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

  private async hydrateOrg(organizationId: string): Promise<Organization> {
    const org = await this.requireOrg(organizationId);
    if (!isMonthlyPeriodExpired(org)) {
      return org;
    }
    await this.activation.syncMonthlyStatus({
      organizationId: org.id,
      status: PlanStatus.CANCELED,
    });
    return this.requireOrg(organizationId);
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

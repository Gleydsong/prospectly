import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import crypto from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  OrgPlan,
  PaymentProvider,
  PlanStatus,
  BillingWebhookEventStatus,
  type Organization,
  type Role,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingActivationService } from './billing-activation.service';
import { CreditPurchaseService } from './credit-purchase.service';
import { CREDIT_PACKAGES } from './credit-purchase.constants';
import { CREDIT_COSTS, FREE_SEARCH_LIMIT, MONTHLY_PLAN_AMOUNT_CENTAVOS } from './billing.constants';
import { hasUnlimitedAccess, isMonthlyPeriodExpired } from './domain/plan-access';
import { EntitlementService } from './entitlement.service';
import { MonthlyCheckoutAttemptService } from './monthly-checkout-attempt.service';
import type {
  BillingCurrency,
  BillingInterval,
  CreditOffer,
  CheckoutResult,
  PaymentMethod,
  PixProviderId,
} from './domain/payment-provider';
import { resolvePaymentProviderId } from './domain/payment-router';
import { AbacatePaymentProvider } from './infrastructure/abacate.payment-provider';
import { AsaasClient, AsaasRequestError } from './infrastructure/asaas.client';

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
    private readonly abacateProvider: AbacatePaymentProvider,
    private readonly asaasClient: AsaasClient,
    private readonly creditPurchases: CreditPurchaseService,
    private readonly entitlements: EntitlementService,
    private readonly monthlyAttempts: MonthlyCheckoutAttemptService,
  ) {}

  async getOrganizationBilling(organizationId: string, role?: Role) {
    const org = await this.hydrateOrg(organizationId);
    const provider = org.paymentProvider;
    const searchUsage = await this.getSearchUsage(org);
    const canManage = role === 'OWNER' || role === 'ADMIN';
    const unlimited = hasUnlimitedAccess(org);
    const checkoutReviewRequired = await this.hasAsaasReviewRequired(organizationId);
    return {
      searchUsage,
      plan: org.plan,
      planStatus: org.planStatus,
      planCurrency: org.planCurrency,
      paymentProvider: provider,
      currentPeriodEnd: org.currentPeriodEnd,
      canCancelSubscription: canManage
        ? org.plan === OrgPlan.STARTER_MONTHLY &&
          unlimited &&
          (provider === PaymentProvider.ABACATE ||
            (provider === PaymentProvider.ASAAS && Boolean(org.asaasSubscriptionId)))
        : false,
      canExportCsv: await this.entitlements.canExportCsv(organizationId),
      freeSearchLimit: FREE_SEARCH_LIMIT,
      creditBalance: org.creditBalance ?? 0,
      checkoutReviewRequired,
    };
  }

  async getSearchUsage(organization: Organization | string): Promise<SearchUsageSnapshot> {
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
    if (interval === 'lifetime') {
      throw new BadRequestException(
        'Lifetime checkout is no longer available. Buy credits or subscribe monthly.',
      );
    }
    const org = await this.hydrateOrg(organizationId);
    if (org.plan === OrgPlan.LIFETIME && org.planStatus === PlanStatus.ACTIVE) {
      throw new BadRequestException(
        'Organization already has an active lifetime plan. Further checkouts are not allowed.',
      );
    }
    await this.assertNoAsaasReviewRequired(organizationId);
    this.assertCanStartAbacatePlanCheckout(org);

    const frontendUrl = this.config.get<string>('frontendUrl') ?? 'http://localhost:5173';
    const successUrl =
      this.config.get<string>('abacate.successUrl') ?? `${frontendUrl}/billing/success`;
    const cancelUrl =
      this.config.get<string>('abacate.cancelUrl') ?? `${frontendUrl}/billing/cancel`;

    const checkoutInput = {
      organizationId,
      customerEmail: userEmail,
      customerName: org.name,
      interval,
      currency: 'BRL',
      paymentMethod,
      successUrl,
      cancelUrl,
      existingCustomerId: org.abacateCustomerId,
    } as const;

    const provider = resolvePaymentProviderId(paymentMethod, this.pixProvider());
    if (provider === 'DISABLED') {
      throw new ServiceUnavailableException('PIX payments are temporarily unavailable');
    }
    if (paymentMethod === 'card') {
      return this.createAsaasMonthlyCheckout(org, successUrl, cancelUrl);
    }
    if (provider === 'ASAAS') {
      return this.createAsaasMonthlyPixCheckout(org);
    }
    return this.abacateProvider.createCheckout(checkoutInput);
  }

  private async createAsaasMonthlyPixCheckout(org: Organization): Promise<CheckoutResult> {
    if (this.config.get<boolean>('asaas.enabled') !== true) {
      throw new ServiceUnavailableException('PIX payments are temporarily unavailable');
    }
    if (
      org.paymentProvider === PaymentProvider.ASAAS &&
      org.plan === OrgPlan.STARTER_MONTHLY &&
      (org.planStatus === PlanStatus.ACTIVE || org.planStatus === PlanStatus.PAST_DUE)
    ) {
      throw new BadRequestException('Organization already has active monthly access');
    }
    if (
      org.paymentProvider &&
      org.paymentProvider !== PaymentProvider.ASAAS &&
      (org.planStatus === PlanStatus.ACTIVE || org.planStatus === PlanStatus.PAST_DUE)
    ) {
      throw new ForbiddenException(
        'A historical subscription is still active. Contact support before starting another plan.',
      );
    }
    const profile = await this.prisma.billingProfile.findUnique({
      where: { organizationId: org.id },
    });
    if (!profile?.asaasCustomerId) {
      throw new BadRequestException('Complete o perfil de cobrança antes de pagar com PIX');
    }
    const begin = await this.monthlyAttempts.beginPix(org.id);
    if (begin.state === 'ready') {
      return this.getAsaasPixCheckout(begin.paymentId, MONTHLY_PLAN_AMOUNT_CENTAVOS);
    }

    let payment: { id: string };
    try {
      payment = await this.asaasClient.createPixPayment({
        customerId: profile.asaasCustomerId,
        amountCentavos: MONTHLY_PLAN_AMOUNT_CENTAVOS,
        externalReference: begin.claim.externalId,
        description: 'Prospectly Ilimitado (30 dias)',
      });
    } catch (error) {
      if (error instanceof AsaasRequestError && !error.ambiguous) {
        await this.monthlyAttempts.markFailed(org.id, begin.claim, error);
      } else {
        await this.monthlyAttempts.markReviewRequired(org.id, begin.claim, error);
      }
      throw this.asaasCheckoutError(error, 'PIX payments are temporarily unavailable');
    }
    await this.monthlyAttempts.markPixReady(
      org.id,
      begin.claim,
      payment.id,
      profile.asaasCustomerId,
    );
    return this.getAsaasPixCheckout(payment.id, MONTHLY_PLAN_AMOUNT_CENTAVOS);
  }

  private async createAsaasMonthlyCheckout(
    org: Organization,
    successUrl: string,
    cancelUrl: string,
  ): Promise<CheckoutResult> {
    if (this.config.get<boolean>('asaas.enabled') !== true) {
      throw new ServiceUnavailableException('Card payments are temporarily unavailable');
    }
    if (
      org.paymentProvider === PaymentProvider.ASAAS &&
      org.plan === OrgPlan.STARTER_MONTHLY &&
      (org.planStatus === PlanStatus.ACTIVE || org.planStatus === PlanStatus.PAST_DUE)
    ) {
      throw new BadRequestException('Organization already has an active monthly subscription');
    }
    if (
      org.paymentProvider &&
      org.paymentProvider !== PaymentProvider.ASAAS &&
      (org.planStatus === PlanStatus.ACTIVE || org.planStatus === PlanStatus.PAST_DUE)
    ) {
      throw new ForbiddenException(
        'A historical subscription is still active. Contact support before starting another plan.',
      );
    }
    const profile = await this.prisma.billingProfile.findUnique({
      where: { organizationId: org.id },
    });
    if (!profile?.asaasCustomerId) {
      throw new BadRequestException('Complete o perfil de cobrança antes de pagar com cartão');
    }
    const begin = await this.monthlyAttempts.beginCard(org.id);
    if (begin.state === 'ready') return begin.checkout;
    try {
      const checkout = await this.asaasClient.createRecurringCheckout({
        externalReference: begin.claim.externalId,
        amountCentavos: MONTHLY_PLAN_AMOUNT_CENTAVOS,
        customer: {
          name: profile.name,
          cpfCnpj: profile.cpfCnpj,
          phone: profile.phone,
          email: profile.email,
        },
        successUrl,
        cancelUrl,
      });
      const result = {
        mode: 'redirect' as const,
        provider: 'ASAAS' as const,
        url: checkout.url,
        externalCheckoutId: checkout.id,
        externalCustomerId: profile.asaasCustomerId,
      };
      await this.monthlyAttempts.markReady(org.id, begin.claim, result);
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        await this.monthlyAttempts.markFailed(org.id, begin.claim, error);
        throw error;
      }
      if (error instanceof AsaasRequestError && !error.ambiguous) {
        await this.monthlyAttempts.markFailed(org.id, begin.claim, error);
        throw new ServiceUnavailableException('Card payments are temporarily unavailable');
      }
      await this.monthlyAttempts.markReviewRequired(org.id, begin.claim, error);
      throw new ServiceUnavailableException('Estamos confirmando seu checkout');
    }
  }

  async createCreditCheckoutSession(
    organizationId: string,
    offer: CreditOffer,
    paymentMethod: PaymentMethod,
  ): Promise<CheckoutResult> {
    await this.requireOrg(organizationId);
    await this.assertNoAsaasReviewRequired(organizationId);
    const pack = CREDIT_PACKAGES[offer];
    if (!pack) throw new BadRequestException('Invalid credit offer');
    const provider = resolvePaymentProviderId(paymentMethod, this.pixProvider());
    if (provider === 'DISABLED') {
      throw new ServiceUnavailableException('PIX payments are temporarily unavailable');
    }
    if (provider === 'ASAAS') {
      return this.createAsaasCreditCheckout(organizationId, offer, pack, paymentMethod);
    }

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

  private async createAsaasCreditCheckout(
    organizationId: string,
    offer: CreditOffer,
    pack: { credits: number; amountCentavos: number },
    paymentMethod: PaymentMethod,
  ): Promise<CheckoutResult> {
    const methodUnavailable =
      paymentMethod === 'pix'
        ? 'PIX payments are temporarily unavailable'
        : 'Card payments are temporarily unavailable';
    if (this.config.get<boolean>('asaas.enabled') !== true) {
      throw new ServiceUnavailableException(methodUnavailable);
    }
    const profile = await this.prisma.billingProfile.findUnique({ where: { organizationId } });
    if (!profile?.asaasCustomerId) {
      throw new BadRequestException(
        paymentMethod === 'pix'
          ? 'Complete o perfil de cobrança antes de pagar com PIX'
          : 'Complete o perfil de cobrança antes de pagar com cartão',
      );
    }

    const externalId = `org:${organizationId}:credits:${crypto.randomUUID()}`;
    const begin = await this.creditPurchases.beginAsaasPackage({
      organizationId,
      offer,
      externalId,
      paymentMethod,
    });
    const purchase = begin.purchase;
    if (!begin.created) {
      if (
        purchase.status === 'PENDING' &&
        purchase.offer === offer &&
        purchase.paymentMethod === (paymentMethod === 'pix' ? 'PIX' : 'CARD') &&
        purchase.externalPaymentId
      ) {
        if (paymentMethod === 'pix') {
          return this.getAsaasPixCheckout(purchase.externalPaymentId, pack.amountCentavos);
        }
        if (!purchase.checkoutUrl) {
          throw new ServiceUnavailableException('Estamos confirmando seu checkout');
        }
        return {
          mode: 'redirect',
          provider: 'ASAAS',
          url: purchase.checkoutUrl,
          externalCheckoutId: purchase.externalPaymentId,
        };
      }
      throw new ServiceUnavailableException('Estamos confirmando seu checkout');
    }
    const frontendUrl = this.config.get<string>('frontendUrl') ?? 'http://localhost:5173';
    if (paymentMethod === 'pix') {
      let payment: { id: string };
      try {
        payment = await this.asaasClient.createPixPayment({
          customerId: profile.asaasCustomerId,
          amountCentavos: pack.amountCentavos,
          externalReference: externalId,
          description: `Prospectly - ${pack.credits.toLocaleString('pt-BR')} créditos`,
        });
      } catch (error) {
        await this.markAsaasPurchaseCreationFailure(purchase.id, error);
        throw this.asaasCheckoutError(error, 'PIX payments are temporarily unavailable');
      }
      await this.creditPurchases.attachPayment(purchase.id, payment.id);
      return this.getAsaasPixCheckout(payment.id, pack.amountCentavos);
    }
    try {
      const payment = await this.asaasClient.createHostedPayment({
        customerId: profile.asaasCustomerId,
        amountCentavos: pack.amountCentavos,
        externalReference: externalId,
        description: `Prospectly - ${pack.credits.toLocaleString('pt-BR')} créditos`,
        successUrl: `${frontendUrl}/billing/success`,
      });
      await this.creditPurchases.attachPayment(purchase.id, payment.id, payment.url);
      return {
        mode: 'redirect',
        provider: 'ASAAS',
        url: payment.url,
        externalCheckoutId: payment.id,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        await this.prisma.creditPurchase.update({
          where: { id: purchase.id },
          data: { status: 'FAILED' },
        });
        throw error;
      }
      if (error instanceof AsaasRequestError && !error.ambiguous) {
        await this.prisma.creditPurchase.update({
          where: { id: purchase.id },
          data: { status: 'FAILED' },
        });
        throw new ServiceUnavailableException('Card payments are temporarily unavailable');
      }
      await this.prisma.creditPurchase.update({
        where: { id: purchase.id },
        data: { status: 'REVIEW_REQUIRED' },
      });
      throw new ServiceUnavailableException('Estamos confirmando seu checkout');
    }
  }

  private async getAsaasPixCheckout(
    paymentId: string,
    amountCentavos: number,
  ): Promise<CheckoutResult> {
    const qr = await this.asaasClient.getPixQrCode(paymentId);
    return {
      mode: 'pix',
      provider: 'ASAAS',
      brCode: qr.payload,
      brCodeBase64: qr.encodedImage,
      externalPaymentId: paymentId,
      amountCentavos,
      ...(qr.expirationDate ? { expiresAt: qr.expirationDate } : {}),
    };
  }

  private async markAsaasPurchaseCreationFailure(
    purchaseId: string,
    error: unknown,
  ): Promise<void> {
    await this.prisma.creditPurchase.update({
      where: { id: purchaseId },
      data: {
        status:
          error instanceof AsaasRequestError && !error.ambiguous ? 'FAILED' : 'REVIEW_REQUIRED',
      },
    });
  }

  private asaasCheckoutError(
    error: unknown,
    unavailableMessage: string,
  ): ServiceUnavailableException {
    return new ServiceUnavailableException(
      error instanceof AsaasRequestError && !error.ambiguous
        ? unavailableMessage
        : 'Estamos confirmando seu checkout',
    );
  }

  private pixProvider(): PixProviderId {
    const configured = this.config.get<string>('billing.pixProvider') ?? 'ASAAS';
    if (configured === 'ABACATE' || configured === 'ASAAS' || configured === 'DISABLED') {
      return configured;
    }
    throw new ServiceUnavailableException('PIX payments are temporarily unavailable');
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

    if (org.paymentProvider === PaymentProvider.ASAAS && org.asaasSubscriptionId) {
      await this.asaasClient.cancelSubscription(org.asaasSubscriptionId);
      await this.activation.syncMonthlyStatus({
        organizationId,
        status: PlanStatus.CANCELED,
        provider: PaymentProvider.ASAAS,
        asaasSubscriptionId: null,
      });
      return { canceled: true };
    }

    throw new BadRequestException('No cancellable subscription for this organization');
  }

  private async assertNoAsaasReviewRequired(organizationId: string): Promise<void> {
    if (await this.hasAsaasReviewRequired(organizationId)) {
      throw new ServiceUnavailableException('Estamos confirmando seu checkout');
    }
  }

  private async hasAsaasReviewRequired(organizationId: string): Promise<boolean> {
    const [purchase, monthlyAttempt] = await Promise.all([
      this.prisma.creditPurchase.findFirst({
        where: {
          organizationId,
          provider: PaymentProvider.ASAAS,
          status: 'REVIEW_REQUIRED',
        },
        select: { id: true },
      }),
      this.prisma.monthlyCheckoutAttempt.findFirst({
        where: {
          organizationId,
          provider: PaymentProvider.ASAAS,
          status: 'REVIEW_REQUIRED',
        },
        select: { id: true },
      }),
    ]);
    return Boolean(purchase || monthlyAttempt);
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
        'A historical Stripe subscription is still active. Contact support before starting another plan.',
      );
    }
  }

  private prismaProvider(_provider: 'ABACATE'): PaymentProvider {
    return PaymentProvider.ABACATE;
  }

  private async claimWebhookEvent(
    provider: 'ABACATE',
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
    const staleBefore = new Date(Date.now() - staleMs);
    const stale =
      existing.status === BillingWebhookEventStatus.PROCESSING &&
      existing.updatedAt.getTime() < staleBefore.getTime();
    if (existing.status === BillingWebhookEventStatus.PROCESSING && !stale) {
      this.logger.debug(`Ignoring in-flight ${provider} webhook event ${eventId}`);
      return false;
    }
    // Only one retrier may reclaim FAILED / stale PROCESSING — avoids concurrent apply.
    const claimed = await this.prisma.billingWebhookEvent.updateMany({
      where: {
        provider,
        eventId,
        OR: [
          { status: BillingWebhookEventStatus.FAILED },
          {
            status: BillingWebhookEventStatus.PROCESSING,
            updatedAt: { lt: staleBefore },
          },
        ],
      },
      data: {
        status: BillingWebhookEventStatus.PROCESSING,
        attempts: { increment: 1 },
        lastError: null,
        failedAt: null,
      },
    });
    if (claimed.count !== 1) {
      this.logger.debug(`Ignoring raced reclaim of ${provider} webhook event ${eventId}`);
      return false;
    }
    return true;
  }

  private async markWebhookProcessed(provider: 'ABACATE', eventId: string): Promise<void> {
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
    provider: 'ABACATE',
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

import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgPlan, PaymentProvider, PlanStatus } from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { BillingActivationService } from '../billing-activation.service';
import { CreditPurchaseService } from '../credit-purchase.service';
import { CREDIT_PACKAGES } from '../credit-purchase.constants';
import type {
  CreditCheckoutRequest,
  CheckoutRequest,
  CheckoutResult,
  ParsedWebhookEvent,
  PaymentProviderAdapter,
  WebhookApplyResult,
} from '../domain/payment-provider';
import { AbacateClient } from './abacate.client';
import {
  chargeId,
  extractOrgIdFromExternalId,
  isConfirmedPaid,
  isCreditPurpose,
  isSubscriptionCheckout,
  normalizeAbacateWebhook,
  type NormalizedAbacateWebhook,
  resolveCustomerId,
  resolveSubscriptionId,
  toChargeLookup,
} from './abacate-webhook';

/**
 * Public HMAC key documented by AbacatePay for `X-Webhook-Signature` verification.
 * Override via `abacate.webhookHmacKey` if Abacate rotates the key.
 */
const DEFAULT_ABACATE_HMAC_PUBLIC_KEY =
  't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';

function equalSecrets(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const CREDIT_PRODUCT_KEYS = {
  'credits-2000': 'abacate.productCredits2000Brl',
  'credits-5000': 'abacate.productCredits5000Brl',
} as const;

@Injectable()
export class AbacatePaymentProvider implements PaymentProviderAdapter {
  readonly id = 'ABACATE' as const;
  private readonly logger = new Logger(AbacatePaymentProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly client: AbacateClient,
    private readonly prisma: PrismaService,
    private readonly activation: BillingActivationService,
    private readonly creditPurchases: CreditPurchaseService,
  ) {}

  async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
    if (input.currency !== 'BRL') {
      throw new BadRequestException('AbacatePay only supports BRL');
    }
    if (input.interval === 'lifetime') {
      throw new BadRequestException(
        'Lifetime checkout is no longer available. Buy credits or subscribe monthly.',
      );
    }
    if (input.paymentMethod === 'card') {
      return this.createMonthlyCard(input);
    }
    return this.createMonthlyPix(input);
  }

  async createCreditCheckout(input: CreditCheckoutRequest): Promise<CheckoutResult> {
    if (input.paymentMethod === 'card') {
      return this.createCreditCardCheckout(input);
    }
    return this.createCreditPixCheckout(input);
  }

  async cancelSubscription(input: {
    organizationId: string;
    externalSubscriptionId: string;
  }): Promise<void> {
    await this.client.cancelSubscription(input.externalSubscriptionId);
    await this.activation.syncMonthlyStatus({
      organizationId: input.organizationId,
      status: PlanStatus.CANCELED,
      abacateSubscriptionId: input.externalSubscriptionId,
    });
  }

  async verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    query?: Record<string, string | string[] | undefined>,
  ): Promise<ParsedWebhookEvent> {
    const expectedSecret = this.config.get<string>('abacate.webhookSecret');
    if (!expectedSecret) {
      throw new ServiceUnavailableException('Abacate webhook secret is not configured');
    }

    const headerSecretRaw =
      headers['x-abacate-webhook-secret'] ??
      headers['X-Abacate-Webhook-Secret'] ??
      headers['x-webhook-secret'];
    const headerSecret = Array.isArray(headerSecretRaw) ? headerSecretRaw[0] : headerSecretRaw;

    const querySecretRaw = query?.webhookSecret ?? query?.secret;
    const querySecret = Array.isArray(querySecretRaw) ? querySecretRaw[0] : querySecretRaw;
    const providedSecret = headerSecret ?? querySecret;
    if (!providedSecret || !equalSecrets(providedSecret, expectedSecret)) {
      throw new UnauthorizedException('Invalid Abacate webhook secret');
    }

    const signatureHeader = headers['x-webhook-signature'] ?? headers['X-Webhook-Signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature) {
      throw new BadRequestException('Missing X-Webhook-Signature header');
    }

    const configuredHmac = this.config.get<string>('abacate.webhookHmacKey')?.trim();
    const hmacKey = configuredHmac || DEFAULT_ABACATE_HMAC_PUBLIC_KEY;
    const expectedSig = createHmac('sha256', hmacKey).update(rawBody).digest('base64');
    const a = Buffer.from(expectedSig);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Invalid Abacate webhook signature');
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw new BadRequestException('Invalid Abacate webhook JSON');
    }

    const normalized = normalizeAbacateWebhook(body);
    if (!normalized) {
      throw new BadRequestException('Abacate webhook missing id/event');
    }

    return { eventId: normalized.eventId, type: normalized.event, payload: body };
  }

  async applyWebhookEvent(payload: unknown, type: string): Promise<WebhookApplyResult> {
    const normalized = normalizeAbacateWebhook(
      typeof payload === 'object' && payload !== null && 'event' in payload
        ? payload
        : { event: type, data: payload },
    );
    const eventId = normalized?.eventId ?? 'unknown';
    if (!normalized) {
      this.logger.debug(`Unhandled Abacate event: ${type}`);
      return { handled: false, eventId, type };
    }

    switch (type) {
      case 'transparent.completed':
        await this.onTransparentCompleted(normalized);
        return { handled: true, eventId, type };
      case 'transparent.refunded':
      case 'transparent.disputed':
      case 'transparent.lost':
        await this.onTransparentRevoked(normalized, type);
        return { handled: true, eventId, type };
      case 'checkout.completed':
        await this.onCheckoutCompleted(normalized);
        return { handled: true, eventId, type };
      case 'checkout.refunded':
      case 'checkout.disputed':
      case 'checkout.lost':
        await this.onCheckoutRevoked(normalized, type);
        return { handled: true, eventId, type };
      case 'subscription.completed':
      case 'subscription.renewed':
        await this.onSubscriptionActive(normalized);
        return { handled: true, eventId, type };
      case 'subscription.payment_failed':
        await this.onSubscriptionPastDue(normalized);
        return { handled: true, eventId, type };
      case 'subscription.cancelled':
        await this.onSubscriptionCancelled(normalized);
        return { handled: true, eventId, type };
      default:
        this.logger.debug(`Unhandled Abacate event: ${type}`);
        return { handled: false, eventId, type };
    }
  }

  private async createMonthlyPix(input: CheckoutRequest): Promise<CheckoutResult> {
    const amountCentavos = this.config.get<number>('abacate.monthlyAmountCentavos');
    if (!amountCentavos || amountCentavos < 1) {
      throw new ServiceUnavailableException('ABACATE_MONTHLY_AMOUNT_CENTAVOS is not configured');
    }

    const charge = await this.client.createTransparentPix({
      amountCentavos,
      description: 'Prospectly Ilimitado (30 dias)',
      externalId: `org:${input.organizationId}:monthly:${randomUUID()}`,
      metadata: {
        organizationId: input.organizationId,
        purpose: 'plan',
        interval: 'monthly',
        currency: 'BRL',
      },
    });

    return {
      mode: 'pix',
      provider: 'ABACATE',
      brCode: charge.brCode,
      brCodeBase64: charge.brCodeBase64,
      externalPaymentId: charge.id,
      amountCentavos: charge.amount ?? amountCentavos,
      expiresAt: charge.expiresAt ?? undefined,
    };
  }

  private async createMonthlyCard(input: CheckoutRequest): Promise<CheckoutResult> {
    const productId = this.requireProductId('abacate.productMonthlyBrl', 'ABACATE_PRODUCT_MONTHLY_BRL');
    const checkout = await this.client.createSubscriptionCheckout({
      productId,
      returnUrl: input.cancelUrl,
      completionUrl: input.successUrl,
      externalId: `org:${input.organizationId}:monthly:${randomUUID()}`,
      metadata: {
        organizationId: input.organizationId,
        purpose: 'plan',
        interval: 'monthly',
        currency: 'BRL',
      },
      customerId: input.existingCustomerId,
    });
    return {
      mode: 'redirect',
      provider: 'ABACATE',
      url: checkout.url,
      externalCheckoutId: checkout.id,
      externalCustomerId: checkout.customerId ?? undefined,
    };
  }

  private async createCreditPixCheckout(input: CreditCheckoutRequest): Promise<CheckoutResult> {
    const pack = CREDIT_PACKAGES[input.offer];
    const charge = await this.client.createTransparentPix({
      amountCentavos: pack.amountCentavos,
      description: input.offer === 'credits-2000' ? 'Prospectly 2.000 créditos' : 'Prospectly 5.000 créditos',
      externalId: input.externalId,
      metadata: {
        organizationId: input.organizationId,
        purpose: 'credits',
        purchaseId: input.purchaseId,
        offer: input.offer,
        credits: String(pack.credits),
        currency: 'BRL',
      },
    });
    await this.creditPurchases.attachPayment(input.purchaseId, charge.id);
    return {
      mode: 'pix',
      provider: 'ABACATE',
      brCode: charge.brCode,
      brCodeBase64: charge.brCodeBase64,
      externalPaymentId: charge.id,
      amountCentavos: charge.amount ?? pack.amountCentavos,
      expiresAt: charge.expiresAt ?? undefined,
    };
  }

  private async createCreditCardCheckout(input: CreditCheckoutRequest): Promise<CheckoutResult> {
    const productId = this.requireProductId(
      CREDIT_PRODUCT_KEYS[input.offer],
      input.offer === 'credits-2000'
        ? 'ABACATE_PRODUCT_CREDITS_2000_BRL'
        : 'ABACATE_PRODUCT_CREDITS_5000_BRL',
    );
    const pack = CREDIT_PACKAGES[input.offer];
    const checkout = await this.client.createOneTimeCheckout({
      productId,
      returnUrl: input.cancelUrl,
      completionUrl: input.successUrl,
      externalId: input.externalId,
      metadata: {
        organizationId: input.organizationId,
        purpose: 'credits',
        purchaseId: input.purchaseId,
        offer: input.offer,
        credits: String(pack.credits),
        currency: 'BRL',
      },
    });
    await this.creditPurchases.attachPayment(input.purchaseId, checkout.id);
    return {
      mode: 'redirect',
      provider: 'ABACATE',
      url: checkout.url,
      externalCheckoutId: checkout.id,
      externalCustomerId: checkout.customerId ?? undefined,
    };
  }

  private requireProductId(configKey: string, envName: string): string {
    const productId = this.config.get<string>(configKey)?.trim();
    if (!productId) {
      throw new ServiceUnavailableException(`${envName} is not configured`);
    }
    return productId;
  }

  private async onTransparentCompleted(normalized: NormalizedAbacateWebhook): Promise<void> {
    const charge = normalized.transparent;
    if (charge && readStatus(charge) && !isConfirmedPaid(charge)) {
      this.logger.warn('transparent.completed without confirmed payment');
      return;
    }
    if (await this.completeCreditsIfMatching(normalized)) return;

    const organizationId = await this.resolveOrganizationId(normalized);
    if (!organizationId) {
      this.logger.warn('transparent.completed without organizationId');
      return;
    }
    const paymentId = chargeId(normalized);
    const metadata = normalized.metadata;

    if (metadata.interval === 'monthly' || metadata.purpose === 'plan') {
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await this.activation.activateMonthly({
        organizationId,
        currency: 'BRL',
        provider: PaymentProvider.ABACATE,
        currentPeriodEnd: periodEnd,
      });
      if (paymentId) {
        await this.prisma.organization.update({
          where: { id: organizationId },
          data: { abacatePaymentId: paymentId },
        });
      }
      return;
    }

    if (metadata.interval !== 'lifetime') return;

    const previous = await this.activation.activateLifetime({
      organizationId,
      currency: 'BRL',
      provider: PaymentProvider.ABACATE,
      abacatePaymentId: paymentId,
    });
    if (previous.previousAbacateSubscriptionId) {
      try {
        await this.cancelSubscription({
          organizationId,
          externalSubscriptionId: previous.previousAbacateSubscriptionId,
        });
      } catch (error) {
        this.logger.error(
          `Failed to cancel prior Abacate subscription after lifetime upgrade for org ${organizationId}: ${(error as Error).message}`,
        );
      }
    }
  }

  private async onTransparentRevoked(
    normalized: NormalizedAbacateWebhook,
    type: string,
  ): Promise<void> {
    if (await this.refundCreditsIfMatching(normalized)) return;

    const paymentId = chargeId(normalized);
    const organizationId = await this.resolveOrganizationId(normalized, paymentId);
    if (!organizationId) {
      this.logger.warn(`Abacate ${type} without organization mapping`);
      return;
    }

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return;

    if (org.plan === OrgPlan.STARTER_MONTHLY && org.paymentProvider === PaymentProvider.ABACATE) {
      if (paymentId && org.abacatePaymentId && org.abacatePaymentId !== paymentId) {
        this.logger.warn(
          `Ignoring ${type} for org ${organizationId}: payment does not match current monthly PIX`,
        );
        return;
      }
      await this.activation.syncMonthlyStatus({
        organizationId,
        status: PlanStatus.CANCELED,
      });
      return;
    }

    await this.activation.revokeLifetime({
      organizationId,
      provider: PaymentProvider.ABACATE,
      abacatePaymentId: paymentId,
    });
  }

  private async onCheckoutCompleted(normalized: NormalizedAbacateWebhook): Promise<void> {
    const paidRecord = normalized.checkout ?? normalized.payment;
    if (paidRecord && !isConfirmedPaid(paidRecord) && readStatus(paidRecord)) {
      this.logger.warn('checkout.completed without confirmed payment');
      return;
    }
    if (isSubscriptionCheckout(normalized) && !isCreditPurpose(normalized.metadata)) {
      return;
    }
    await this.completeCreditsIfMatching(normalized);
  }

  private async onCheckoutRevoked(
    normalized: NormalizedAbacateWebhook,
    type: string,
  ): Promise<void> {
    if (isSubscriptionCheckout(normalized) && !isCreditPurpose(normalized.metadata)) {
      this.logger.warn(`Ignoring ${type} for subscription checkout; wait for subscription events`);
      return;
    }
    await this.refundCreditsIfMatching(normalized);
  }

  private async onSubscriptionActive(normalized: NormalizedAbacateWebhook): Promise<void> {
    const organizationId = await this.resolveOrganizationId(normalized);
    if (!organizationId) {
      this.logger.warn('subscription active event without organization mapping');
      return;
    }
    await this.activation.activateMonthly({
      organizationId,
      currency: 'BRL',
      provider: PaymentProvider.ABACATE,
      abacateSubscriptionId: resolveSubscriptionId(normalized),
      abacateCustomerId: resolveCustomerId(normalized),
    });
  }

  private async onSubscriptionPastDue(normalized: NormalizedAbacateWebhook): Promise<void> {
    const organizationId = await this.resolveOrganizationId(normalized);
    if (!organizationId) return;
    await this.activation.syncMonthlyStatus({
      organizationId,
      status: PlanStatus.PAST_DUE,
      abacateSubscriptionId: resolveSubscriptionId(normalized),
      abacateCustomerId: resolveCustomerId(normalized),
    });
  }

  private async onSubscriptionCancelled(normalized: NormalizedAbacateWebhook): Promise<void> {
    const organizationId = await this.resolveOrganizationId(normalized);
    if (!organizationId) return;
    await this.activation.syncMonthlyStatus({
      organizationId,
      status: PlanStatus.CANCELED,
      abacateSubscriptionId: resolveSubscriptionId(normalized),
      abacateCustomerId: resolveCustomerId(normalized),
    });
  }

  private async completeCreditsIfMatching(normalized: NormalizedAbacateWebhook): Promise<boolean> {
    const purchase = await this.creditPurchases.findMatching(toChargeLookup(normalized));
    if (!purchase && !isCreditPurpose(normalized.metadata)) return false;
    if (!purchase) return false;
    await this.creditPurchases.completeFromWebhook(toChargeLookup(normalized));
    return true;
  }

  private async refundCreditsIfMatching(normalized: NormalizedAbacateWebhook): Promise<boolean> {
    const purchase = await this.creditPurchases.findMatching(toChargeLookup(normalized));
    if (!purchase) return isCreditPurpose(normalized.metadata);
    await this.creditPurchases.refundFromWebhook(toChargeLookup(normalized));
    return true;
  }

  private async resolveOrganizationId(
    normalized: NormalizedAbacateWebhook,
    paymentId = chargeId(normalized),
  ): Promise<string | undefined> {
    const purchase = await this.creditPurchases.findMatching(toChargeLookup(normalized));
    if (purchase) return purchase.organizationId;

    const fromMeta = normalized.metadata.organizationId;
    if (fromMeta) {
      const org = await this.prisma.organization.findFirst({
        where: { id: fromMeta, deletedAt: null },
        select: { id: true },
      });
      if (org) return org.id;
    }

    const fromExternal = extractOrgIdFromExternalId(toChargeLookup(normalized).externalId as string | undefined);
    if (fromExternal) {
      const org = await this.prisma.organization.findFirst({
        where: { id: fromExternal, deletedAt: null },
        select: { id: true },
      });
      if (org) return org.id;
    }

    const subscriptionId = resolveSubscriptionId(normalized);
    if (subscriptionId) {
      const bySub = await this.prisma.organization.findFirst({
        where: { abacateSubscriptionId: subscriptionId, deletedAt: null },
        select: { id: true },
      });
      if (bySub) return bySub.id;
    }

    const customerId = resolveCustomerId(normalized);
    if (customerId) {
      const byCustomer = await this.prisma.organization.findFirst({
        where: { abacateCustomerId: customerId, deletedAt: null },
        select: { id: true },
      });
      if (byCustomer) return byCustomer.id;
    }

    if (paymentId) {
      const byPayment = await this.prisma.organization.findFirst({
        where: { abacatePaymentId: paymentId, deletedAt: null },
        select: { id: true },
      });
      if (byPayment) return byPayment.id;
    }

    return undefined;
  }
}

function readStatus(record: Record<string, unknown> | null): string | undefined {
  const value = record?.status;
  return typeof value === 'string' ? value : undefined;
}

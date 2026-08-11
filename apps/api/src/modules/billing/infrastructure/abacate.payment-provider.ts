import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgPlan, PaymentProvider, PlanStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';

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

/**
 * Public HMAC key documented by AbacatePay for `X-Webhook-Signature` verification.
 * Override via `abacate.webhookHmacKey` if Abacate rotates the key.
 */

function equalSecrets(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
const DEFAULT_ABACATE_HMAC_PUBLIC_KEY =
  't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';

type AbacateWebhookBody = {
  id?: string;
  event?: string;
  data?: Record<string, unknown> | null;
};

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
      return this.createLifetimePix(input);
    }

    return this.createMonthlyPix(input);
  }

  async createCreditCheckout(input: CreditCheckoutRequest): Promise<CheckoutResult> {
    const pack = CREDIT_PACKAGES[input.offer];
    const charge = await this.client.createTransparentPix({
      amountCentavos: pack.amountCentavos,
      description: input.offer === 'credits-2000' ? 'Prospectly 2.000 créditos' : 'Prospectly 5.000 créditos',
      externalId: input.externalId,
      metadata: {
        organizationId: input.organizationId,
        purchaseId: input.purchaseId,
        offer: input.offer,
        credits: String(pack.credits),
        currency: 'BRL',
      },
    });
    if (!charge.brCode || !charge.brCodeBase64) {
      throw new ServiceUnavailableException('AbacatePay did not return PIX codes');
    }
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

    // Prefer header secret; query `webhookSecret`/`secret` is fallback for one release.
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

    const hmacKey =
      this.config.get<string>('abacate.webhookHmacKey') ?? DEFAULT_ABACATE_HMAC_PUBLIC_KEY;
    const expectedSig = createHmac('sha256', hmacKey).update(rawBody).digest('base64');
    const a = Buffer.from(expectedSig);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Invalid Abacate webhook signature');
    }

    let body: AbacateWebhookBody;
    try {
      body = JSON.parse(rawBody.toString('utf8')) as AbacateWebhookBody;
    } catch {
      throw new BadRequestException('Invalid Abacate webhook JSON');
    }

    if (!body.id || !body.event) {
      throw new BadRequestException('Abacate webhook missing id/event');
    }

    return { eventId: body.id, type: body.event, payload: body };
  }

  async applyWebhookEvent(payload: unknown, type: string): Promise<WebhookApplyResult> {
    const body = payload as AbacateWebhookBody;
    const eventId = body.id ?? 'unknown';
    const rawData = (body.data ?? {}) as Record<string, unknown>;

    switch (type) {
      case 'transparent.completed': {
        // Abacate v2 nests charge fields under data.transparent and often omits metadata.
        const data = this.normalizeTransparentData(rawData);
        if (this.isCreditPayment(data)) await this.creditPurchases.completeFromWebhook(data);
        else await this.onTransparentCompleted(data);
        return { handled: true, eventId, type };
      }
      case 'transparent.refunded':
      case 'transparent.lost': {
        const data = this.normalizeTransparentData(rawData);
        if (this.isCreditPayment(data)) await this.creditPurchases.refundFromWebhook(data);
        else await this.onTransparentRevoked(data, type);
        return { handled: true, eventId, type };
      }
      case 'subscription.completed':
      case 'subscription.renewed':
        await this.onSubscriptionActive(rawData);
        return { handled: true, eventId, type };
      case 'subscription.cancelled':
        await this.onSubscriptionCancelled(rawData);
        return { handled: true, eventId, type };
      case 'checkout.completed':
        await this.onCheckoutCompleted(rawData);
        return { handled: true, eventId, type };
      default:
        this.logger.debug(`Unhandled Abacate event: ${type}`);
        return { handled: false, eventId, type };
    }
  }

  private async createLifetimePix(input: CheckoutRequest): Promise<CheckoutResult> {
    const amountCentavos = this.config.get<number>('abacate.lifetimeAmountCentavos');
    if (!amountCentavos || amountCentavos < 1) {
      throw new ServiceUnavailableException('ABACATE_LIFETIME_AMOUNT_CENTAVOS is not configured');
    }

    const charge = await this.client.createTransparentPix({
      amountCentavos,
      description: 'Prospectly Lifetime',
      externalId: `org:${input.organizationId}:lifetime`,
      metadata: {
        organizationId: input.organizationId,
        interval: 'lifetime',
        currency: 'BRL',
      },
    });

    if (!charge.brCode || !charge.brCodeBase64) {
      throw new ServiceUnavailableException('AbacatePay did not return PIX codes');
    }

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

  private async createMonthlyPix(input: CheckoutRequest): Promise<CheckoutResult> {
    const amountCentavos = this.config.get<number>('abacate.monthlyAmountCentavos');
    if (!amountCentavos || amountCentavos < 1) {
      throw new ServiceUnavailableException('ABACATE_MONTHLY_AMOUNT_CENTAVOS is not configured');
    }

    const charge = await this.client.createTransparentPix({
      amountCentavos,
      description: 'Prospectly Ilimitado (30 dias)',
      externalId: `org:${input.organizationId}:monthly:${Date.now()}`,
      metadata: {
        organizationId: input.organizationId,
        interval: 'monthly',
        currency: 'BRL',
      },
    });

    if (!charge.brCode || !charge.brCodeBase64) {
      throw new ServiceUnavailableException('AbacatePay did not return PIX codes');
    }

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

  private async onTransparentCompleted(data: Record<string, unknown>): Promise<void> {
    const organizationId = this.resolveOrganizationId(data);
    if (!organizationId) {
      this.logger.warn('transparent.completed without organizationId');
      return;
    }

    const paymentId = typeof data.id === 'string' ? data.id : undefined;
    const interval = this.resolveTransparentInterval(data);

    // Official webhooks omit metadata; never default unknown PIX to LIFETIME.
    if (interval === 'monthly') {
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

    if (interval !== 'lifetime') {
      this.logger.warn(
        `transparent.completed for org ${organizationId} without resolvable plan interval (externalId/metadata); skipping entitlement`,
      );
      return;
    }

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
          `Failed to cancel prior Abacate subscription ${previous.previousAbacateSubscriptionId} after lifetime upgrade for org ${organizationId}: ${(error as Error).message}`,
        );
      }
    }
  }

  private async onTransparentRevoked(
    data: Record<string, unknown>,
    type: string,
  ): Promise<void> {
    const paymentId = typeof data.id === 'string' ? data.id : undefined;
    let organizationId = this.resolveOrganizationId(data);

    if (!organizationId && paymentId) {
      const byPayment = await this.prisma.organization.findFirst({
        where: { abacatePaymentId: paymentId },
      });
      organizationId = byPayment?.id;
    }

    if (!organizationId) {
      this.logger.warn(`Abacate ${type} without organization mapping`);
      return;
    }

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return;

    if (org.plan === OrgPlan.STARTER_MONTHLY && org.paymentProvider === PaymentProvider.ABACATE) {
      this.logger.warn(
        `Revoking monthly PIX entitlement for org ${organizationId} after Abacate ${type}`,
      );
      await this.activation.syncMonthlyStatus({
        organizationId,
        status: PlanStatus.CANCELED,
      });
      return;
    }

    this.logger.warn(
      `Revoking lifetime entitlement for org ${organizationId} after Abacate ${type}`,
    );
    await this.activation.revokeLifetime({
      organizationId,
      provider: PaymentProvider.ABACATE,
      abacatePaymentId: paymentId,
    });
  }

  private async onSubscriptionActive(data: Record<string, unknown>): Promise<void> {
    const organizationId = await this.resolveOrganizationIdOrLookup(data);
    if (!organizationId) {
      this.logger.warn('subscription active event without organization mapping');
      return;
    }

    const subscriptionId = typeof data.id === 'string' ? data.id : undefined;
    const customerId = typeof data.customerId === 'string' ? data.customerId : undefined;

    await this.activation.activateMonthly({
      organizationId,
      currency: 'BRL',
      provider: PaymentProvider.ABACATE,
      abacateSubscriptionId: subscriptionId,
      abacateCustomerId: customerId,
    });
  }

  private async onSubscriptionCancelled(data: Record<string, unknown>): Promise<void> {
    const organizationId = await this.resolveOrganizationIdOrLookup(data);
    if (!organizationId) return;

    await this.activation.syncMonthlyStatus({
      organizationId,
      status: PlanStatus.CANCELED,
      abacateSubscriptionId: typeof data.id === 'string' ? data.id : undefined,
    });
  }

  private async onCheckoutCompleted(data: Record<string, unknown>): Promise<void> {
    const metadata = this.readMetadata(data);
    if (metadata.interval === 'lifetime') {
      await this.onTransparentCompleted(data);
      return;
    }
    await this.onSubscriptionActive(data);
  }

  private resolveOrganizationId(data: Record<string, unknown>): string | undefined {
    const metadata = this.readMetadata(data);
    if (metadata.organizationId) return metadata.organizationId;
    if (typeof data.externalId === 'string') {
      const match = /^org:([^:]+):/.exec(data.externalId);
      if (match?.[1]) return match[1];
    }
    return undefined;
  }

  private async resolveOrganizationIdOrLookup(
    data: Record<string, unknown>,
  ): Promise<string | undefined> {
    const fromMeta = this.resolveOrganizationId(data);
    if (fromMeta) return fromMeta;

    const subscriptionId = typeof data.id === 'string' ? data.id : undefined;
    if (subscriptionId) {
      const bySub = await this.prisma.organization.findFirst({
        where: { abacateSubscriptionId: subscriptionId },
      });
      if (bySub) return bySub.id;
    }

    const customerId = typeof data.customerId === 'string' ? data.customerId : undefined;
    if (customerId) {
      const byCustomer = await this.prisma.organization.findFirst({
        where: { abacateCustomerId: customerId },
      });
      if (byCustomer) return byCustomer.id;
    }

    return undefined;
  }

  private readMetadata(data: Record<string, unknown>): Record<string, string> {
    const raw = data.metadata;
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  }

  /**
   * Abacate webhook v2 puts the charge under `data.transparent` and often omits
   * `metadata` entirely. Flatten so id/externalId/metadata resolve consistently
   * with our legacy flat fixtures and create-response shape.
   */
  private normalizeTransparentData(data: Record<string, unknown>): Record<string, unknown> {
    const nested = data.transparent;
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
      return data;
    }
    const charge = nested as Record<string, unknown>;
    const { transparent: _nested, ...rest } = data;
    const nestedMeta =
      charge.metadata && typeof charge.metadata === 'object' && !Array.isArray(charge.metadata)
        ? (charge.metadata as Record<string, unknown>)
        : {};
    const topMeta =
      rest.metadata && typeof rest.metadata === 'object' && !Array.isArray(rest.metadata)
        ? (rest.metadata as Record<string, unknown>)
        : {};
    return {
      ...charge,
      ...rest,
      id: typeof charge.id === 'string' ? charge.id : rest.id,
      externalId:
        typeof charge.externalId === 'string'
          ? charge.externalId
          : typeof rest.externalId === 'string'
            ? rest.externalId
            : undefined,
      metadata: { ...nestedMeta, ...topMeta },
    };
  }

  /**
   * Prefer metadata.interval; fall back to externalId shapes we stamp at checkout:
   * `org:{id}:monthly:{ts}`, `org:{id}:lifetime`, `org:{id}:credits:{uuid}`.
   */
  private resolveTransparentInterval(
    data: Record<string, unknown>,
  ): 'monthly' | 'lifetime' | 'credits' | undefined {
    const metadata = this.readMetadata(data);
    if (metadata.interval === 'monthly' || metadata.interval === 'lifetime') {
      return metadata.interval;
    }
    if (metadata.purchaseId || metadata.offer?.startsWith('credits-')) {
      return 'credits';
    }
    const externalId = typeof data.externalId === 'string' ? data.externalId : '';
    if (/^org:[^:]+:credits:/.test(externalId)) return 'credits';
    if (/^org:[^:]+:monthly(?::|$)/.test(externalId)) return 'monthly';
    if (/^org:[^:]+:lifetime(?::|$)/.test(externalId)) return 'lifetime';
    return undefined;
  }

  private isCreditPayment(data: Record<string, unknown>): boolean {
    return this.resolveTransparentInterval(data) === 'credits';
  }
}

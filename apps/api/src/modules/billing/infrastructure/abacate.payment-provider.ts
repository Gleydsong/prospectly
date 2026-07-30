import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PlanStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { BillingActivationService } from '../billing-activation.service';
import type {
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
  ) {}

  async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
    if (input.currency !== 'BRL') {
      throw new BadRequestException('AbacatePay only supports BRL');
    }

    if (input.interval === 'lifetime') {
      return this.createLifetimePix(input);
    }

    return this.createMonthlySubscription(input);
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
    const data = (body.data ?? {}) as Record<string, unknown>;

    switch (type) {
      case 'transparent.completed':
        await this.onTransparentCompleted(data);
        return { handled: true, eventId, type };
      case 'transparent.refunded':
      case 'transparent.lost':
        this.logger.warn(`Abacate transparent non-success event: ${type}`);
        return { handled: true, eventId, type };
      case 'subscription.completed':
      case 'subscription.renewed':
        await this.onSubscriptionActive(data);
        return { handled: true, eventId, type };
      case 'subscription.cancelled':
        await this.onSubscriptionCancelled(data);
        return { handled: true, eventId, type };
      case 'checkout.completed':
        await this.onCheckoutCompleted(data);
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

  private async createMonthlySubscription(input: CheckoutRequest): Promise<CheckoutResult> {
    const productId = this.config.get<string>('abacate.productMonthlyBrl');
    if (!productId) {
      throw new ServiceUnavailableException('ABACATE_PRODUCT_MONTHLY_BRL is not configured');
    }

    const checkout = await this.client.createSubscriptionCheckout({
      productId,
      returnUrl: input.cancelUrl,
      completionUrl: input.successUrl,
      externalId: `org:${input.organizationId}:monthly`,
      customerId: input.existingCustomerId,
      metadata: {
        organizationId: input.organizationId,
        interval: 'monthly',
        currency: 'BRL',
      },
    });

    if (!checkout.url) {
      throw new ServiceUnavailableException('AbacatePay did not return a checkout URL');
    }

    return {
      mode: 'redirect',
      url: checkout.url,
      provider: 'ABACATE',
      externalCustomerId: checkout.customerId ?? undefined,
      externalCheckoutId: checkout.id,
    };
  }

  private async onTransparentCompleted(data: Record<string, unknown>): Promise<void> {
    const organizationId = this.resolveOrganizationId(data);
    if (!organizationId) {
      this.logger.warn('transparent.completed without organizationId');
      return;
    }

    const paymentId = typeof data.id === 'string' ? data.id : undefined;
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
}

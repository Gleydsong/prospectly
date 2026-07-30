import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PlanStatus } from '@prisma/client';
import Stripe from 'stripe';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { BillingActivationService } from '../billing-activation.service';
import type {
  BillingCurrency,
  BillingInterval,
  CheckoutRequest,
  CheckoutResult,
  ParsedWebhookEvent,
  PaymentProviderAdapter,
  WebhookApplyResult,
} from '../domain/payment-provider';

@Injectable()
export class StripePaymentProvider implements PaymentProviderAdapter {
  readonly id = 'STRIPE' as const;
  private readonly logger = new Logger(StripePaymentProvider.name);
  private readonly stripe: Stripe | null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly activation: BillingActivationService,
  ) {
    const secret = this.config.get<string>('stripe.secretKey');
    this.stripe = secret ? new Stripe(secret) : null;
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }
    return this.stripe;
  }

  resolvePriceId(interval: BillingInterval, currency: BillingCurrency): string {
    if (currency === 'BRL') {
      throw new BadRequestException('BRL checkout is handled by AbacatePay');
    }
    const key = `stripe.prices.${interval}.${currency.toLowerCase()}` as const;
    const priceId = this.config.get<string>(key);
    if (!priceId) {
      throw new BadRequestException(`Price not configured for ${interval}/${currency}`);
    }
    return priceId;
  }

  async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
    const stripe = this.requireStripe();
    const priceId = this.resolvePriceId(input.interval, input.currency);
    let customerId = input.existingCustomerId ?? undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: input.customerEmail,
        name: input.customerName,
        metadata: { organizationId: input.organizationId },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: input.interval === 'monthly' ? 'subscription' : 'payment',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.organizationId,
      metadata: {
        organizationId: input.organizationId,
        interval: input.interval,
        currency: input.currency,
      },
      ...(input.interval === 'monthly'
        ? {
            subscription_data: {
              metadata: { organizationId: input.organizationId, currency: input.currency },
            },
          }
        : {
            payment_intent_data: {
              metadata: {
                organizationId: input.organizationId,
                currency: input.currency,
                interval: input.interval,
              },
            },
          }),
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL');
    }

    return {
      mode: 'redirect',
      url: session.url,
      provider: 'STRIPE',
      externalCustomerId: customerId,
      externalCheckoutId: session.id,
    };
  }

  async createPortal(input: {
    organizationId: string;
    externalCustomerId: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: input.externalCustomerId,
      return_url: input.returnUrl,
    });
    return { url: session.url };
  }

  async verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<ParsedWebhookEvent> {
    const stripe = this.requireStripe();
    const secret = this.config.get<string>('stripe.webhookSecret');
    if (!secret) {
      throw new ServiceUnavailableException('Stripe webhook secret is not configured');
    }

    const signatureHeader = headers['stripe-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    try {
      const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
      return { eventId: event.id, type: event.type, payload: event };
    } catch (error) {
      this.logger.warn(`Webhook signature verification failed: ${(error as Error).message}`);
      throw new BadRequestException('Invalid Stripe webhook signature');
    }
  }

  async applyWebhookEvent(payload: unknown, type: string): Promise<WebhookApplyResult> {
    const event = payload as Stripe.Event;
    const eventId = event.id;

    switch (type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        return { handled: true, eventId, type };
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.onSubscriptionChanged(event.data.object as Stripe.Subscription);
        return { handled: true, eventId, type };
      case 'invoice.paid':
        await this.onInvoicePaid(event.data.object as Stripe.Invoice);
        return { handled: true, eventId, type };
      default:
        this.logger.debug(`Unhandled Stripe event: ${type}`);
        return { handled: false, eventId, type };
    }
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const organizationId =
      session.metadata?.organizationId ?? session.client_reference_id ?? undefined;
    if (!organizationId) {
      this.logger.warn('checkout.session.completed without organizationId');
      return;
    }

    const interval = (session.metadata?.interval ??
      (session.mode === 'subscription' ? 'monthly' : 'lifetime')) as BillingInterval;
    const currency = (session.metadata?.currency ?? session.currency?.toUpperCase() ?? 'EUR') as
      | BillingCurrency;

    const customerId = typeof session.customer === 'string' ? session.customer : undefined;

    if (interval === 'lifetime' || session.mode === 'payment') {
      const previous = await this.activation.activateLifetime({
        organizationId,
        currency,
        provider: PaymentProvider.STRIPE,
        stripeCustomerId: customerId,
      });

      if (previous.previousStripeSubscriptionId) {
        try {
          const stripe = this.requireStripe();
          await stripe.subscriptions.cancel(previous.previousStripeSubscriptionId);
        } catch (error) {
          this.logger.error(
            `Failed to cancel prior Stripe subscription ${previous.previousStripeSubscriptionId} after lifetime upgrade for org ${organizationId}: ${(error as Error).message}`,
          );
        }
      }
      return;
    }

    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    await this.activation.activateMonthly({
      organizationId,
      currency,
      provider: PaymentProvider.STRIPE,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    });
  }

  private async onSubscriptionChanged(subscription: Stripe.Subscription): Promise<void> {
    const organizationId = subscription.metadata?.organizationId;
    const org = organizationId
      ? await this.prisma.organization.findUnique({ where: { id: organizationId } })
      : await this.prisma.organization.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });

    if (!org) {
      this.logger.warn(`Subscription ${subscription.id} not mapped to organization`);
      return;
    }

    await this.activation.syncMonthlyStatus({
      organizationId: org.id,
      status: this.mapSubscriptionStatus(subscription.status),
      stripeSubscriptionId: subscription.id,
      stripeCustomerId:
        typeof subscription.customer === 'string' ? subscription.customer : org.stripeCustomerId,
      currentPeriodEnd: this.subscriptionPeriodEnd(subscription),
    });
  }

  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
    if (!customerId) return;

    const org = await this.prisma.organization.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!org) return;

    await this.activation.markInvoicePaid(org.id);
  }

  private mapSubscriptionStatus(status: Stripe.Subscription.Status): PlanStatus {
    switch (status) {
      case 'active':
      case 'trialing':
        return PlanStatus.ACTIVE;
      case 'past_due':
      case 'unpaid':
        return PlanStatus.PAST_DUE;
      case 'canceled':
      case 'incomplete_expired':
        return PlanStatus.CANCELED;
      default:
        return PlanStatus.INACTIVE;
    }
  }

  private subscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
    const item = subscription.items?.data?.[0] as { current_period_end?: number } | undefined;
    const end =
      item?.current_period_end ??
      (subscription as unknown as { current_period_end?: number }).current_period_end;
    return typeof end === 'number' ? new Date(end * 1000) : null;
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgPlan, PlanStatus, type Organization } from '@prisma/client';
import Stripe from 'stripe';

import { PrismaService } from '../../common/prisma/prisma.service';
import { FREE_SEARCH_LIMIT } from './billing.constants';
import type { BillingCurrency, BillingInterval } from './dto/create-checkout.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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
    const key = `stripe.prices.${interval}.${currency.toLowerCase()}` as const;
    const priceId = this.config.get<string>(key);
    if (!priceId) {
      throw new BadRequestException(`Price not configured for ${interval}/${currency}`);
    }
    return priceId;
  }

  async getOrganizationBilling(organizationId: string) {
    const org = await this.requireOrg(organizationId);
    return {
      plan: org.plan,
      planStatus: org.planStatus,
      planCurrency: org.planCurrency,
      currentPeriodEnd: org.currentPeriodEnd,
      hasStripeCustomer: Boolean(org.stripeCustomerId),
      freeSearchLimit: FREE_SEARCH_LIMIT,
    };
  }

  async assertCanCreateSearch(organizationId: string): Promise<void> {
    const org = await this.requireOrg(organizationId);
    if (org.planStatus === PlanStatus.ACTIVE) {
      return;
    }

    const searchCount = await this.prisma.search.count({ where: { organizationId } });
    if (searchCount >= FREE_SEARCH_LIMIT) {
      throw new ForbiddenException(
        `Free plan allows ${FREE_SEARCH_LIMIT} searches. Upgrade to continue.`,
      );
    }
  }

  async createCheckoutSession(
    organizationId: string,
    userEmail: string,
    interval: BillingInterval,
    currency: BillingCurrency,
  ): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    const org = await this.requireOrg(organizationId);
    const priceId = this.resolvePriceId(interval, currency);
    const customerId = await this.ensureCustomer(org, userEmail);

    const successUrl =
      this.config.get<string>('stripe.successUrl') ??
      `${this.config.get<string>('frontendUrl')}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      this.config.get<string>('stripe.cancelUrl') ??
      `${this.config.get<string>('frontendUrl')}/billing/cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: interval === 'monthly' ? 'subscription' : 'payment',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: organizationId,
      metadata: {
        organizationId,
        interval,
        currency,
      },
      ...(interval === 'monthly'
        ? {
            subscription_data: {
              metadata: { organizationId, currency },
            },
          }
        : {
            payment_intent_data: {
              metadata: { organizationId, currency, interval },
            },
          }),
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL');
    }

    return { url: session.url };
  }

  async createPortalSession(organizationId: string): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    const org = await this.requireOrg(organizationId);
    if (!org.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer for this organization');
    }

    const returnUrl =
      this.config.get<string>('stripe.portalReturnUrl') ??
      `${this.config.get<string>('frontendUrl')}/settings`;

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<{ received: true }> {
    const stripe = this.requireStripe();
    const secret = this.config.get<string>('stripe.webhookSecret');
    if (!secret) {
      throw new ServiceUnavailableException('Stripe webhook secret is not configured');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (error) {
      this.logger.warn(`Webhook signature verification failed: ${(error as Error).message}`);
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'checkout.session.async_payment_failed':
        this.logger.warn(
          `Async checkout payment failed for session ${
            (event.data.object as Stripe.Checkout.Session).id
          }`,
        );
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.onSubscriptionChanged(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.paid':
        await this.onInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }

    return { received: true };
  }

  private isCheckoutPaid(session: Stripe.Checkout.Session): boolean {
    // Delayed methods (e.g. boleto/bank transfer) complete checkout with payment_status=unpaid.
    // Only activate entitlements once funds are secured.
    return session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const organizationId =
      session.metadata?.organizationId ?? session.client_reference_id ?? undefined;
    if (!organizationId) {
      this.logger.warn('checkout.session.completed without organizationId');
      return;
    }

    if (!this.isCheckoutPaid(session)) {
      this.logger.log(
        `Skipping entitlement activation for unpaid checkout session ${session.id} (org=${organizationId})`,
      );
      return;
    }

    const interval = (session.metadata?.interval ??
      (session.mode === 'subscription' ? 'monthly' : 'lifetime')) as BillingInterval;
    const currency = (session.metadata?.currency ?? session.currency?.toUpperCase() ?? null) as
      | BillingCurrency
      | null;

    if (interval === 'lifetime' || session.mode === 'payment') {
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: {
          plan: OrgPlan.LIFETIME,
          planStatus: PlanStatus.ACTIVE,
          planCurrency: currency,
          stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
          currentPeriodEnd: null,
          stripeSubscriptionId: null,
        },
      });
      return;
    }

    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: OrgPlan.STARTER_MONTHLY,
        planStatus: PlanStatus.ACTIVE,
        planCurrency: currency,
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
        stripeSubscriptionId: subscriptionId ?? undefined,
      },
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

    if (org.plan === OrgPlan.LIFETIME) {
      return;
    }

    const status = this.mapSubscriptionStatus(subscription.status);
    const periodEnd = this.subscriptionPeriodEnd(subscription);

    await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        plan: OrgPlan.STARTER_MONTHLY,
        planStatus: status,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId:
          typeof subscription.customer === 'string' ? subscription.customer : org.stripeCustomerId,
        currentPeriodEnd: periodEnd,
        ...(status === PlanStatus.CANCELED || status === PlanStatus.INACTIVE
          ? { plan: OrgPlan.FREE }
          : {}),
      },
    });
  }

  private invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
    const fromParent = invoice.parent?.subscription_details?.subscription;
    if (typeof fromParent === 'string') return fromParent;
    if (fromParent && typeof fromParent === 'object' && 'id' in fromParent) {
      return fromParent.id;
    }
    // Legacy payloads / older API versions may still expose subscription at the top level.
    const legacy = (invoice as unknown as { subscription?: string | { id: string } | null })
      .subscription;
    if (typeof legacy === 'string') return legacy;
    if (legacy && typeof legacy === 'object' && 'id' in legacy) return legacy.id;
    return null;
  }

  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
    if (!customerId) return;

    const subscriptionId = this.invoiceSubscriptionId(invoice);
    if (!subscriptionId) {
      this.logger.debug(`Ignoring invoice.paid ${invoice.id} without subscription`);
      return;
    }

    const org = await this.prisma.organization.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!org || org.plan === OrgPlan.LIFETIME) return;

    // Ignore stale/out-of-order invoices after cancel or subscription replacement.
    if (!org.stripeSubscriptionId || org.stripeSubscriptionId !== subscriptionId) {
      this.logger.warn(
        `Ignoring invoice.paid ${invoice.id}: subscription ${subscriptionId} does not match org ${org.id}`,
      );
      return;
    }

    await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        planStatus: PlanStatus.ACTIVE,
        plan: OrgPlan.STARTER_MONTHLY,
      },
    });
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

  private async ensureCustomer(org: Organization, email: string): Promise<string> {
    const stripe = this.requireStripe();
    if (org.stripeCustomerId) return org.stripeCustomerId;

    const customer = await stripe.customers.create({
      email,
      name: org.name,
      metadata: { organizationId: org.id },
    });

    await this.prisma.organization.update({
      where: { id: org.id },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
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
}

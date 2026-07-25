import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgPlan, PaymentProvider, PlanStatus, type Organization } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingActivationService } from './billing-activation.service';
import { FREE_SEARCH_LIMIT } from './billing.constants';
import type {
  BillingCurrency,
  BillingInterval,
  CheckoutResult,
  PaymentProviderId,
} from './domain/payment-provider';
import { resolvePaymentProviderId } from './domain/payment-router';
import { AbacatePaymentProvider } from './infrastructure/abacate.payment-provider';
import { StripePaymentProvider } from './infrastructure/stripe.payment-provider';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly activation: BillingActivationService,
    private readonly stripeProvider: StripePaymentProvider,
    private readonly abacateProvider: AbacatePaymentProvider,
  ) {}

  async getOrganizationBilling(organizationId: string) {
    const org = await this.requireOrg(organizationId);
    const provider = org.paymentProvider;
    return {
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
  ): Promise<CheckoutResult> {
    const org = await this.requireOrg(organizationId);
    const providerId = resolvePaymentProviderId(currency);
    this.assertProviderCompatible(org, providerId);

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
      currency,
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

  async createPortalSession(organizationId: string): Promise<{ url: string }> {
    const org = await this.requireOrg(organizationId);
    if (org.paymentProvider === PaymentProvider.ABACATE) {
      throw new BadRequestException(
        'Customer portal is only available for Stripe (EUR/USD). Cancel via API for Abacate subscriptions.',
      );
    }
    if (!org.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer for this organization');
    }

    const returnUrl =
      this.config.get<string>('stripe.portalReturnUrl') ??
      `${this.config.get<string>('frontendUrl')}/settings`;

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
      if (!org.abacateSubscriptionId) {
        throw new BadRequestException('No Abacate subscription for this organization');
      }
      await this.abacateProvider.cancelSubscription({
        organizationId,
        externalSubscriptionId: org.abacateSubscriptionId,
      });
      return { canceled: true };
    }

    if (!org.stripeSubscriptionId) {
      throw new BadRequestException('No Stripe subscription for this organization');
    }

    // Stripe: cancel via portal is preferred; API cancel not exposed here yet.
    // Mark intent by requiring portal — keep explicit error for Stripe.
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
    await this.stripeProvider.applyWebhookEvent(parsed.payload, parsed.type);
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
    await this.abacateProvider.applyWebhookEvent(parsed.payload, parsed.type);
    return { received: true };
  }

  private assertProviderCompatible(org: Organization, next: PaymentProviderId): void {
    if (!org.paymentProvider) return;
    if (org.paymentProvider === next) return;
    if (org.planStatus === PlanStatus.ACTIVE) {
      throw new ForbiddenException(
        'Organization already has an active plan on another payment provider. Currency/gateway migration is not supported.',
      );
    }
    throw new ForbiddenException(
      'Organization is bound to another payment provider. Use the same currency as the existing gateway.',
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

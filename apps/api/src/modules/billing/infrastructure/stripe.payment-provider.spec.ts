import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { BillingActivationService } from '../billing-activation.service';
import { CreditPurchaseService } from '../credit-purchase.service';
import { StripePaymentProvider } from './stripe.payment-provider';

describe('StripePaymentProvider', () => {
  let provider: StripePaymentProvider;

  const prisma = {
    organization: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const activation = {
    activateLifetime: jest.fn(),
    activateMonthly: jest.fn(),
    markInvoicePaid: jest.fn(),
    syncMonthlyStatus: jest.fn(),
  };

  const creditPurchases = {
    attachPayment: jest.fn(),
    completeFromWebhook: jest.fn(),
    refundFromWebhook: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    activation.activateLifetime.mockResolvedValue({});
    activation.activateMonthly.mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripePaymentProvider,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
        { provide: BillingActivationService, useValue: activation },
        { provide: CreditPurchaseService, useValue: creditPurchases },
      ],
    }).compile();
    provider = module.get(StripePaymentProvider);
  });

  it('does not activate entitlements for an unpaid completed checkout', async () => {
    await provider.applyWebhookEvent(
      {
        id: 'evt_unpaid',
        data: {
          object: {
            id: 'cs_unpaid',
            mode: 'payment',
            payment_status: 'unpaid',
            metadata: { organizationId: 'org_1', interval: 'lifetime', currency: 'EUR' },
          },
        },
      },
      'checkout.session.completed',
    );

    expect(activation.activateLifetime).not.toHaveBeenCalled();
    expect(activation.activateMonthly).not.toHaveBeenCalled();
  });

  it('does not grant lifetime for Stripe payment checkouts without credit metadata', async () => {
    await provider.applyWebhookEvent(
      {
        id: 'evt_async_paid',
        data: {
          object: {
            id: 'cs_async_paid',
            mode: 'payment',
            payment_status: 'paid',
            customer: 'cus_1',
            metadata: { organizationId: 'org_1', interval: 'lifetime', currency: 'BRL' },
          },
        },
      },
      'checkout.session.async_payment_succeeded',
    );

    expect(activation.activateLifetime).not.toHaveBeenCalled();
    expect(activation.activateMonthly).not.toHaveBeenCalled();
    expect(creditPurchases.completeFromWebhook).not.toHaveBeenCalled();
  });

  it('fulfills credit packs from paid Stripe payment checkouts', async () => {
    creditPurchases.completeFromWebhook.mockResolvedValue(undefined);

    await provider.applyWebhookEvent(
      {
        id: 'evt_credits_paid',
        data: {
          object: {
            id: 'cs_credits',
            mode: 'payment',
            payment_status: 'paid',
            customer: 'cus_1',
            metadata: {
              organizationId: 'org_1',
              purpose: 'credits',
              purchaseId: 'purchase_1',
              offer: 'credits-2000',
            },
          },
        },
      },
      'checkout.session.completed',
    );

    expect(creditPurchases.completeFromWebhook).toHaveBeenCalledWith({
      id: 'cs_credits',
      metadata: {
        purchaseId: 'purchase_1',
        organizationId: 'org_1',
        offer: 'credits-2000',
      },
    });
    expect(activation.activateLifetime).not.toHaveBeenCalled();
  });

  it('activates no-payment-required subscription checkouts', async () => {
    await provider.applyWebhookEvent(
      {
        id: 'evt_trial',
        data: {
          object: {
            id: 'cs_trial',
            mode: 'subscription',
            payment_status: 'no_payment_required',
            customer: 'cus_1',
            subscription: 'sub_1',
            metadata: { organizationId: 'org_1', interval: 'monthly', currency: 'BRL' },
          },
        },
      },
      'checkout.session.completed',
    );

    expect(activation.activateMonthly).toHaveBeenCalledWith({
      organizationId: 'org_1',
      currency: 'BRL',
      provider: PaymentProvider.STRIPE,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
    });
  });

  it('ignores paid invoices for a stale subscription', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org_1',
      stripeSubscriptionId: 'sub_current',
    });

    await provider.applyWebhookEvent(
      {
        id: 'evt_stale_invoice',
        data: {
          object: {
            id: 'in_stale',
            customer: 'cus_1',
            parent: { subscription_details: { subscription: 'sub_old' } },
          },
        },
      },
      'invoice.paid',
    );

    expect(activation.markInvoicePaid).not.toHaveBeenCalled();
  });

  it('marks the current subscription invoice as paid', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org_1',
      stripeSubscriptionId: 'sub_current',
    });

    await provider.applyWebhookEvent(
      {
        id: 'evt_current_invoice',
        data: {
          object: {
            id: 'in_current',
            customer: 'cus_1',
            parent: { subscription_details: { subscription: 'sub_current' } },
          },
        },
      },
      'invoice.paid',
    );

    expect(activation.markInvoicePaid).toHaveBeenCalledWith('org_1');
  });
});

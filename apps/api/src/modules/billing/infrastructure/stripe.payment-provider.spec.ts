import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { BillingActivationService } from '../billing-activation.service';
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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripePaymentProvider,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
        { provide: BillingActivationService, useValue: activation },
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

  it('activates a paid delayed checkout after async payment succeeds', async () => {
    await provider.applyWebhookEvent(
      {
        id: 'evt_async_paid',
        data: {
          object: {
            id: 'cs_async_paid',
            mode: 'payment',
            payment_status: 'paid',
            customer: 'cus_1',
            metadata: { organizationId: 'org_1', interval: 'lifetime', currency: 'EUR' },
          },
        },
      },
      'checkout.session.async_payment_succeeded',
    );

    expect(activation.activateLifetime).toHaveBeenCalledWith({
      organizationId: 'org_1',
      currency: 'EUR',
      provider: PaymentProvider.STRIPE,
      stripeCustomerId: 'cus_1',
    });
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
            metadata: { organizationId: 'org_1', interval: 'monthly', currency: 'EUR' },
          },
        },
      },
      'checkout.session.completed',
    );

    expect(activation.activateMonthly).toHaveBeenCalledWith({
      organizationId: 'org_1',
      currency: 'EUR',
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

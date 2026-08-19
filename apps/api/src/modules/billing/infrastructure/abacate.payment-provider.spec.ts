import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PlanStatus } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';
import { createHmac } from 'node:crypto';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { BillingActivationService } from '../billing-activation.service';
import { AbacateClient } from './abacate.client';
import { AbacatePaymentProvider } from './abacate.payment-provider';
import { CreditPurchaseService } from '../credit-purchase.service';

const HMAC_KEY =
  't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';

describe('AbacatePaymentProvider', () => {
  let provider: AbacatePaymentProvider;

  const client = {
    createTransparentPix: jest.fn(),
    createOneTimeCheckout: jest.fn(),
    createSubscriptionCheckout: jest.fn(),
    cancelSubscription: jest.fn(),
  };

  const activation = {
    activateLifetime: jest.fn().mockResolvedValue({
      previousStripeSubscriptionId: null,
      previousAbacateSubscriptionId: null,
    }),
    activateMonthly: jest.fn(),
    syncMonthlyStatus: jest.fn(),
    revokeLifetime: jest.fn(),
  };

  const prisma = {
    organization: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const creditPurchases = {
    attachPayment: jest.fn(),
    completeFromWebhook: jest.fn(),
    refundFromWebhook: jest.fn(),
    findMatching: jest.fn().mockResolvedValue(null),
  };

  const configGet = jest.fn((key: string) => {
    const map: Record<string, string | number> = {
      'abacate.webhookSecret': 'whsec_test',
      'abacate.monthlyAmountCentavos': 4999,
      'abacate.productMonthlyBrl': 'prod_monthly',
      'abacate.productCredits2000Brl': 'prod_credits_2000',
      'abacate.productCredits5000Brl': 'prod_credits_5000',
    };
    return map[key];
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    creditPurchases.findMatching.mockResolvedValue(null);
    configGet.mockImplementation((key: string) => {
      const map: Record<string, string | number> = {
        'abacate.webhookSecret': 'whsec_test',
        'abacate.monthlyAmountCentavos': 4999,
        'abacate.productMonthlyBrl': 'prod_monthly',
        'abacate.productCredits2000Brl': 'prod_credits_2000',
        'abacate.productCredits5000Brl': 'prod_credits_5000',
      };
      return map[key];
    });
    prisma.organization.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (typeof where.id === 'string') return { id: where.id };
      return null;
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbacatePaymentProvider,
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: AbacateClient, useValue: client },
        { provide: PrismaService, useValue: prisma },
        { provide: BillingActivationService, useValue: activation },
        { provide: CreditPurchaseService, useValue: creditPurchases },
      ],
    }).compile();
    provider = module.get(AbacatePaymentProvider);
  });

  it('creates monthly PIX (transparent 30-day)', async () => {
    client.createTransparentPix.mockResolvedValue({
      id: 'pix_m1',
      amount: 4999,
      brCode: '000201',
      brCodeBase64: 'data:image/png;base64,abc',
    });

    const result = await provider.createCheckout({
      organizationId: 'org1',
      customerEmail: 'a@b.com',
      interval: 'monthly',
      currency: 'BRL',
      paymentMethod: 'pix',
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    });

    expect(result.mode).toBe('pix');
    expect(client.createTransparentPix).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCentavos: 4999,
        metadata: expect.objectContaining({ interval: 'monthly', purpose: 'plan' }),
        externalId: expect.stringMatching(/^org:org1:monthly:[0-9a-f-]{36}$/i),
      }),
    );
    expect(client.createSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it('creates monthly card via subscriptions/create', async () => {
    client.createSubscriptionCheckout.mockResolvedValue({
      id: 'bill_sub',
      url: 'https://app.abacatepay.com/pay/bill_sub',
      customerId: 'cust_1',
    });
    const result = await provider.createCheckout({
      organizationId: 'org1',
      customerEmail: 'a@b.com',
      interval: 'monthly',
      currency: 'BRL',
      paymentMethod: 'card',
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    });
    expect(result).toEqual(
      expect.objectContaining({
        mode: 'redirect',
        provider: 'ABACATE',
        url: 'https://app.abacatepay.com/pay/bill_sub',
        externalCheckoutId: 'bill_sub',
      }),
    );
    expect(client.createSubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'prod_monthly' }),
    );
    expect(client.createTransparentPix).not.toHaveBeenCalled();
  });

  it('fails monthly card checkout when the monthly product id is missing', async () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'abacate.productMonthlyBrl') return '';
      if (key === 'abacate.webhookSecret') return 'whsec_test';
      if (key === 'abacate.monthlyAmountCentavos') return 4999;
      return undefined;
    });
    await expect(
      provider.createCheckout({
        organizationId: 'org1',
        customerEmail: 'a@b.com',
        interval: 'monthly',
        currency: 'BRL',
        paymentMethod: 'card',
        successUrl: 'https://app/success',
        cancelUrl: 'https://app/cancel',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(client.createSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it('rejects lifetime checkout', async () => {
    await expect(
      provider.createCheckout({
        organizationId: 'org1',
        customerEmail: 'a@b.com',
        interval: 'lifetime',
        currency: 'BRL',
        paymentMethod: 'pix',
        successUrl: 'https://app/success',
        cancelUrl: 'https://app/cancel',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a PIX checkout with the selected credit offer metadata', async () => {
    client.createTransparentPix.mockResolvedValue({
      id: 'pix_credits_1',
      amount: 999,
      brCode: '000201',
      brCodeBase64: 'data:image/png;base64,abc',
    });
    const result = await provider.createCreditCheckout({
      organizationId: 'org1',
      offer: 'credits-2000',
      paymentMethod: 'pix',
      purchaseId: 'purchase_1',
      externalId: 'org:org1:credits:purchase_1',
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    });
    expect(result).toEqual(expect.objectContaining({ mode: 'pix', amountCentavos: 999 }));
    expect(client.createTransparentPix).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCentavos: 999,
        metadata: expect.objectContaining({
          purchaseId: 'purchase_1',
          offer: 'credits-2000',
          purpose: 'credits',
        }),
      }),
    );
    expect(creditPurchases.attachPayment).toHaveBeenCalledWith('purchase_1', 'pix_credits_1');
  });

  it('creates credit card checkout with the mapped product', async () => {
    client.createOneTimeCheckout.mockResolvedValue({
      id: 'bill_credits',
      url: 'https://app.abacatepay.com/pay/bill_credits',
    });
    const result = await provider.createCreditCheckout({
      organizationId: 'org1',
      offer: 'credits-5000',
      paymentMethod: 'card',
      purchaseId: 'purchase_2',
      externalId: 'org:org1:credits:purchase_2',
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    });
    expect(result).toEqual(
      expect.objectContaining({ mode: 'redirect', provider: 'ABACATE', externalCheckoutId: 'bill_credits' }),
    );
    expect(client.createOneTimeCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'prod_credits_5000',
        externalId: 'org:org1:credits:purchase_2',
      }),
    );
    expect(creditPurchases.attachPayment).toHaveBeenCalledWith('purchase_2', 'bill_credits');
  });

  it('fails credit card checkout when product id is missing', async () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'abacate.productCredits2000Brl') return '';
      if (key === 'abacate.webhookSecret') return 'whsec_test';
      return undefined;
    });
    await expect(
      provider.createCreditCheckout({
        organizationId: 'org1',
        offer: 'credits-2000',
        paymentMethod: 'card',
        purchaseId: 'purchase_1',
        externalId: 'ext',
        successUrl: 'https://app/success',
        cancelUrl: 'https://app/cancel',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('completes PIX credits from nested transparent.completed', async () => {
    creditPurchases.findMatching.mockResolvedValue({
      id: 'purchase_1',
      organizationId: 'org1',
    });
    await provider.applyWebhookEvent(
      {
        id: 'log_pix',
        event: 'transparent.completed',
        data: {
          transparent: {
            id: 'pix_credits_1',
            status: 'PAID',
            paidAmount: 999,
            amount: 999,
            metadata: { purchaseId: 'purchase_1', purpose: 'credits' },
          },
        },
      },
      'transparent.completed',
    );
    expect(creditPurchases.completeFromWebhook).toHaveBeenCalled();
    expect(activation.activateMonthly).not.toHaveBeenCalled();
  });

  it('completes card credits from nested checkout.completed', async () => {
    creditPurchases.findMatching.mockResolvedValue({
      id: 'purchase_1',
      organizationId: 'org1',
    });
    await provider.applyWebhookEvent(
      {
        event: 'checkout.completed',
        data: {
          checkout: {
            id: 'bill_abc123xyz',
            externalId: 'org:org1:credits:purchase_1',
            amount: 999,
            paidAmount: 999,
            frequency: 'ONE_TIME',
            status: 'PAID',
            methods: ['CARD'],
            metadata: { purchaseId: 'purchase_1', purpose: 'credits' },
          },
          customer: { id: 'cust_abc123' },
        },
      },
      'checkout.completed',
    );
    expect(creditPurchases.completeFromWebhook).toHaveBeenCalled();
    expect(activation.activateMonthly).not.toHaveBeenCalled();
  });

  it('does not complete credits from a subscription checkout.completed', async () => {
    await provider.applyWebhookEvent(
      {
        event: 'checkout.completed',
        data: {
          checkout: {
            id: 'bill_sub',
            frequency: 'SUBSCRIPTION',
            status: 'PAID',
            paidAmount: 4999,
            amount: 4999,
            metadata: { purpose: 'plan', interval: 'monthly', organizationId: 'org1' },
          },
        },
      },
      'checkout.completed',
    );
    expect(creditPurchases.completeFromWebhook).not.toHaveBeenCalled();
    expect(activation.activateMonthly).not.toHaveBeenCalled();
  });

  it('refunds credits on checkout.refunded without going negative', async () => {
    creditPurchases.findMatching.mockResolvedValue({ id: 'purchase_1', organizationId: 'org1' });
    await provider.applyWebhookEvent(
      {
        id: 'log_refund',
        event: 'checkout.refunded',
        data: {
          checkout: {
            id: 'bill_abc123xyz',
            status: 'PAID',
            metadata: { purchaseId: 'purchase_1', purpose: 'credits' },
          },
        },
      },
      'checkout.refunded',
    );
    expect(creditPurchases.refundFromWebhook).toHaveBeenCalled();
  });

  it('activates monthly PIX on transparent.completed', async () => {
    await provider.applyWebhookEvent(
      {
        id: 'log_m',
        event: 'transparent.completed',
        data: {
          transparent: {
            id: 'pix_m1',
            status: 'PAID',
            paidAmount: 4999,
            amount: 4999,
            metadata: { organizationId: 'org1', interval: 'monthly', purpose: 'plan' },
          },
        },
      },
      'transparent.completed',
    );
    expect(activation.activateMonthly).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        provider: PaymentProvider.ABACATE,
      }),
    );
  });

  it('activates plan on subscription.completed using nested ids', async () => {
    await provider.applyWebhookEvent(
      {
        id: 'log_taQArRTApemxwcbw5EJeF3hS',
        event: 'subscription.completed',
        data: {
          subscription: { id: 'subs_tAFqDWBhcEYTjQh2K0ZYDHau', status: 'ACTIVE' },
          customer: { id: 'cust_def456' },
          checkout: {
            id: 'bill_jskd3TMfScHZDJe5NSZjTmQ4',
            frequency: 'SUBSCRIPTION',
            metadata: { organizationId: 'org1', purpose: 'plan', interval: 'monthly' },
          },
        },
      },
      'subscription.completed',
    );
    expect(activation.activateMonthly).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        abacateSubscriptionId: 'subs_tAFqDWBhcEYTjQh2K0ZYDHau',
        abacateCustomerId: 'cust_def456',
      }),
    );
  });

  it('keeps the plan active on subscription.renewed', async () => {
    await provider.applyWebhookEvent(
      {
        id: 'log_renew',
        event: 'subscription.renewed',
        data: {
          subscription: { id: 'subs_1', status: 'ACTIVE' },
          customer: { id: 'cust_1' },
          checkout: { metadata: { organizationId: 'org1', purpose: 'plan' } },
        },
      },
      'subscription.renewed',
    );
    expect(activation.activateMonthly).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org1', abacateSubscriptionId: 'subs_1' }),
    );
  });

  it('marks PAST_DUE on subscription.payment_failed', async () => {
    await provider.applyWebhookEvent(
      {
        id: 'log_fail',
        event: 'subscription.payment_failed',
        data: {
          subscription: { id: 'subs_1', status: 'ACTIVE' },
          checkout: { metadata: { organizationId: 'org1' } },
        },
      },
      'subscription.payment_failed',
    );
    expect(activation.syncMonthlyStatus).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org1', status: PlanStatus.PAST_DUE }),
    );
  });

  it('cancels the plan on subscription.cancelled', async () => {
    await provider.applyWebhookEvent(
      {
        id: 'log_cancel',
        event: 'subscription.cancelled',
        data: {
          subscription: { id: 'subs_1', status: 'CANCELLED' },
          customer: { id: 'cust_1' },
          checkout: { metadata: { organizationId: 'org1' } },
        },
      },
      'subscription.cancelled',
    );
    expect(activation.syncMonthlyStatus).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org1', status: PlanStatus.CANCELED }),
    );
  });

  it('ignores unknown events without changing entitlement', async () => {
    const result = await provider.applyWebhookEvent(
      { id: 'log_x', event: 'customer.created', data: { customer: { id: 'cust_1' } } },
      'customer.created',
    );
    expect(result.handled).toBe(false);
    expect(activation.activateMonthly).not.toHaveBeenCalled();
  });

  it('verifies webhook HMAC + secret', async () => {
    const raw = Buffer.from(
      JSON.stringify({ id: 'log_1', event: 'transparent.completed', data: {} }),
      'utf8',
    );
    const signature = createHmac('sha256', HMAC_KEY).update(raw).digest('base64');

    const parsed = await provider.verifyAndParseWebhook(
      raw,
      { 'x-webhook-signature': signature },
      { webhookSecret: 'whsec_test' },
    );
    expect(parsed.eventId).toBe('log_1');
  });

  it('treats blank HMAC override as the public key', async () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'abacate.webhookHmacKey') return '   ';
      const map: Record<string, string | number> = {
        'abacate.webhookSecret': 'whsec_test',
        'abacate.monthlyAmountCentavos': 4999,
        'abacate.productMonthlyBrl': 'prod_monthly',
        'abacate.productCredits2000Brl': 'prod_credits_2000',
        'abacate.productCredits5000Brl': 'prod_credits_5000',
      };
      return map[key];
    });
    const raw = Buffer.from(
      JSON.stringify({ id: 'log_blank', event: 'transparent.completed', data: {} }),
      'utf8',
    );
    const signature = createHmac('sha256', HMAC_KEY).update(raw).digest('base64');
    const parsed = await provider.verifyAndParseWebhook(
      raw,
      { 'x-webhook-signature': signature },
      { webhookSecret: 'whsec_test' },
    );
    expect(parsed.eventId).toBe('log_blank');
  });

  it('rejects bad webhook signature', async () => {
    const raw = Buffer.from(JSON.stringify({ id: 'log_1', event: 'x', data: {} }), 'utf8');
    await expect(
      provider.verifyAndParseWebhook(
        raw,
        { 'x-webhook-signature': 'bad' },
        { webhookSecret: 'whsec_test' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects wrong webhook secret', async () => {
    const raw = Buffer.from(JSON.stringify({ id: 'log_1', event: 'x', data: {} }), 'utf8');
    const signature = createHmac('sha256', HMAC_KEY).update(raw).digest('base64');
    await expect(
      provider.verifyAndParseWebhook(
        raw,
        { 'x-webhook-signature': signature },
        { webhookSecret: 'wrong' },
      ),
    ).rejects.toBeInstanceOf(Error);
  });
});

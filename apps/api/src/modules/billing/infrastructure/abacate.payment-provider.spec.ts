import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '@prisma/client';
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
  };

  const configGet = jest.fn((key: string) => {
    const map: Record<string, string | number> = {
      'abacate.webhookSecret': 'whsec_test',
      'abacate.lifetimeAmountCentavos': 39900,
      'abacate.monthlyAmountCentavos': 4999,
      'abacate.productMonthlyBrl': 'prod_monthly',
    };
    return map[key];
  });

  beforeEach(async () => {
    jest.clearAllMocks();
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

  it('creates lifetime PIX (transparent)', async () => {
    client.createTransparentPix.mockResolvedValue({
      id: 'pix_1',
      amount: 39900,
      brCode: '000201',
      brCodeBase64: 'data:image/png;base64,abc',
      expiresAt: '2026-07-25T12:00:00.000Z',
    });

    const result = await provider.createCheckout({
      organizationId: 'org1',
      customerEmail: 'a@b.com',
      interval: 'lifetime',
      currency: 'BRL',
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    });

    expect(result.mode).toBe('pix');
    expect(client.createTransparentPix).toHaveBeenCalled();
    expect(client.createSubscriptionCheckout).not.toHaveBeenCalled();
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
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    });

    expect(result.mode).toBe('pix');
    expect(client.createTransparentPix).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCentavos: 4999,
        metadata: expect.objectContaining({ interval: 'monthly' }),
      }),
    );
    expect(client.createSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it('creates a PIX checkout with the selected credit offer metadata', async () => {
    client.createTransparentPix.mockResolvedValue({
      id: 'pix_credits_1', amount: 999, brCode: '000201', brCodeBase64: 'data:image/png;base64,abc',
    });
    const result = await provider.createCreditCheckout({
      organizationId: 'org1', offer: 'credits-2000', purchaseId: 'purchase_1',
      externalId: 'org:org1:credits:purchase_1', successUrl: 'https://app/success', cancelUrl: 'https://app/cancel',
    });
    expect(result).toEqual(expect.objectContaining({ mode: 'pix', amountCentavos: 999 }));
    expect(client.createTransparentPix).toHaveBeenCalledWith(expect.objectContaining({
      amountCentavos: 999,
      metadata: expect.objectContaining({ purchaseId: 'purchase_1', offer: 'credits-2000', credits: '2000' }),
    }));
    expect(creditPurchases.attachPayment).toHaveBeenCalledWith('purchase_1', 'pix_credits_1');
  });

  it('routes confirmed credit webhooks to the credit purchase service', async () => {
    await provider.applyWebhookEvent({ id: 'pix_credits_1', data: { metadata: { purchaseId: 'purchase_1' } } }, 'transparent.completed');
    expect(creditPurchases.completeFromWebhook).toHaveBeenCalledWith({ metadata: { purchaseId: 'purchase_1' } });
    expect(activation.activateLifetime).not.toHaveBeenCalled();
  });

  it('fails lifetime when amount env missing', async () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'abacate.lifetimeAmountCentavos') return 0;
      if (key === 'abacate.webhookSecret') return 'whsec_test';
      return undefined;
    });
    await expect(
      provider.createCheckout({
        organizationId: 'org1',
        customerEmail: 'a@b.com',
        interval: 'lifetime',
        currency: 'BRL',
        successUrl: 'https://app/success',
        cancelUrl: 'https://app/cancel',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('activates lifetime on transparent.completed', async () => {
    await provider.applyWebhookEvent(
      {
        id: 'log_1',
        event: 'transparent.completed',
        data: {
          id: 'pix_1',
          metadata: { organizationId: 'org1', interval: 'lifetime' },
        },
      },
      'transparent.completed',
    );
    expect(activation.activateLifetime).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        provider: PaymentProvider.ABACATE,
        abacatePaymentId: 'pix_1',
      }),
    );
    expect(client.cancelSubscription).not.toHaveBeenCalled();
  });

  it('cancels prior monthly Abacate subscription after lifetime upgrade', async () => {
    activation.activateLifetime.mockResolvedValue({
      previousStripeSubscriptionId: null,
      previousAbacateSubscriptionId: 'subs_old',
    });

    await provider.applyWebhookEvent(
      {
        id: 'log_upgrade',
        event: 'transparent.completed',
        data: {
          id: 'pix_2',
          metadata: { organizationId: 'org1', interval: 'lifetime' },
        },
      },
      'transparent.completed',
    );

    expect(client.cancelSubscription).toHaveBeenCalledWith('subs_old');
  });

  it('revokes lifetime on transparent.refunded', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org1',
      plan: 'LIFETIME',
      paymentProvider: PaymentProvider.ABACATE,
    });
    await provider.applyWebhookEvent(
      {
        id: 'log_refund',
        event: 'transparent.refunded',
        data: {
          id: 'pix_1',
          metadata: { organizationId: 'org1', interval: 'lifetime' },
        },
      },
      'transparent.refunded',
    );
    expect(activation.revokeLifetime).toHaveBeenCalledWith({
      organizationId: 'org1',
      provider: PaymentProvider.ABACATE,
      abacatePaymentId: 'pix_1',
    });
    expect(activation.activateLifetime).not.toHaveBeenCalled();
  });

  it('revokes lifetime on transparent.lost via abacatePaymentId lookup', async () => {
    prisma.organization.findFirst.mockResolvedValue({ id: 'org1' });
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org1',
      plan: 'LIFETIME',
      paymentProvider: PaymentProvider.ABACATE,
    });
    await provider.applyWebhookEvent(
      {
        id: 'log_lost',
        event: 'transparent.lost',
        data: { id: 'pix_lost' },
      },
      'transparent.lost',
    );
    expect(prisma.organization.findFirst).toHaveBeenCalledWith({
      where: { abacatePaymentId: 'pix_lost' },
    });
    expect(activation.revokeLifetime).toHaveBeenCalledWith({
      organizationId: 'org1',
      provider: PaymentProvider.ABACATE,
      abacatePaymentId: 'pix_lost',
    });
  });

  it('revokes monthly PIX when the refunded charge matches the active payment', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org1',
      plan: 'STARTER_MONTHLY',
      paymentProvider: PaymentProvider.ABACATE,
      abacatePaymentId: 'pix_current',
    });
    await provider.applyWebhookEvent(
      {
        id: 'log_monthly_refund',
        event: 'transparent.refunded',
        data: {
          id: 'pix_current',
          metadata: { organizationId: 'org1', interval: 'monthly' },
        },
      },
      'transparent.refunded',
    );
    expect(activation.syncMonthlyStatus).toHaveBeenCalledWith({
      organizationId: 'org1',
      status: 'CANCELED',
    });
  });

  it('ignores monthly PIX refunds for a previous charge after renew', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org1',
      plan: 'STARTER_MONTHLY',
      paymentProvider: PaymentProvider.ABACATE,
      abacatePaymentId: 'pix_renewal',
    });
    await provider.applyWebhookEvent(
      {
        id: 'log_stale_refund',
        event: 'transparent.refunded',
        data: {
          id: 'pix_old',
          metadata: { organizationId: 'org1', interval: 'monthly' },
        },
      },
      'transparent.refunded',
    );
    expect(activation.syncMonthlyStatus).not.toHaveBeenCalled();
    expect(activation.revokeLifetime).not.toHaveBeenCalled();
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

  it('accepts webhook secret from header (preferred over query)', async () => {
    const raw = Buffer.from(
      JSON.stringify({ id: 'log_2', event: 'transparent.completed', data: {} }),
      'utf8',
    );
    const signature = createHmac('sha256', HMAC_KEY).update(raw).digest('base64');

    const parsed = await provider.verifyAndParseWebhook(
      raw,
      {
        'x-webhook-signature': signature,
        'x-abacate-webhook-secret': 'whsec_test',
      },
      { webhookSecret: 'wrong-query-ignored' },
    );
    expect(parsed.eventId).toBe('log_2');
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
});

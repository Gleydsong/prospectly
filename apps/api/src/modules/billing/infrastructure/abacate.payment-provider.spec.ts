import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';
import { createHmac } from 'node:crypto';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { BillingActivationService } from '../billing-activation.service';
import { AbacateClient } from './abacate.client';
import { AbacatePaymentProvider } from './abacate.payment-provider';

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
    activateLifetime: jest.fn(),
    activateMonthly: jest.fn(),
    syncMonthlyStatus: jest.fn(),
    revokeLifetime: jest.fn(),
  };

  const prisma = {
    organization: {
      findFirst: jest.fn(),
    },
  };

  const configGet = jest.fn((key: string) => {
    const map: Record<string, string | number> = {
      'abacate.webhookSecret': 'whsec_test',
      'abacate.lifetimeAmountCentavos': 39900,
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
      ],
    }).compile();
    provider = module.get(AbacatePaymentProvider);
  });

  it('creates lifetime PIX (transparent) and never monthly transparent', async () => {
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

  it('creates monthly subscription redirect with CARD methods', async () => {
    client.createSubscriptionCheckout.mockResolvedValue({
      id: 'bill_1',
      url: 'https://app.abacatepay.com/pay/bill_1',
      customerId: 'cust_1',
    });

    const result = await provider.createCheckout({
      organizationId: 'org1',
      customerEmail: 'a@b.com',
      interval: 'monthly',
      currency: 'BRL',
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    });

    expect(result).toEqual(
      expect.objectContaining({
        mode: 'redirect',
        url: 'https://app.abacatepay.com/pay/bill_1',
        provider: 'ABACATE',
      }),
    );
    expect(client.createSubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'prod_monthly' }),
    );
    expect(client.createTransparentPix).not.toHaveBeenCalled();
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
  });

  it('revokes lifetime on transparent.refunded', async () => {
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

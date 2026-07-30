import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgPlan, PlanStatus } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingActivationService } from './billing-activation.service';
import { BillingService } from './billing.service';
import { AbacatePaymentProvider } from './infrastructure/abacate.payment-provider';
import { StripePaymentProvider } from './infrastructure/stripe.payment-provider';

describe('BillingService', () => {
  let service: BillingService;
  const prisma = {
    organization: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    search: {
      count: jest.fn(),
    },
    billingWebhookEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const stripeProvider = {
    createCheckout: jest.fn(),
    createPortal: jest.fn(),
    verifyAndParseWebhook: jest.fn(),
    applyWebhookEvent: jest.fn(),
  };

  const abacateProvider = {
    createCheckout: jest.fn(),
    cancelSubscription: jest.fn(),
    verifyAndParseWebhook: jest.fn(),
    applyWebhookEvent: jest.fn(),
  };

  const activation = {
    bindCheckoutIntent: jest.fn().mockResolvedValue(undefined),
  };

  const configGet = jest.fn((key: string) => {
    const map: Record<string, string> = {
      'stripe.successUrl': 'https://app.test/success',
      'stripe.cancelUrl': 'https://app.test/cancel',
      'stripe.portalReturnUrl': 'https://app.test/settings',
      'abacate.successUrl': 'https://app.test/success',
      'abacate.cancelUrl': 'https://app.test/cancel',
      frontendUrl: 'https://app.test',
    };
    return map[key];
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: BillingActivationService, useValue: activation },
        { provide: StripePaymentProvider, useValue: stripeProvider },
        { provide: AbacatePaymentProvider, useValue: abacateProvider },
      ],
    }).compile();
    service = module.get(BillingService);
  });

  it('allows searches when plan is ACTIVE', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      planStatus: PlanStatus.ACTIVE,
      deletedAt: null,
    });
    await expect(service.assertCanCreateSearch('org1')).resolves.toBeUndefined();
  });

  it('blocks free org after 3 searches', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      planStatus: PlanStatus.INACTIVE,
      plan: OrgPlan.FREE,
      deletedAt: null,
    });
    prisma.search.count.mockResolvedValue(3);
    await expect(service.assertCanCreateSearch('org1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('routes EUR monthly checkout to Stripe redirect', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      name: 'Acme',
      stripeCustomerId: 'cus_1',
      paymentProvider: null,
      deletedAt: null,
    });
    stripeProvider.createCheckout.mockResolvedValue({
      mode: 'redirect',
      url: 'https://checkout.stripe.com/test',
      provider: 'STRIPE',
      externalCustomerId: 'cus_1',
    });

    const result = await service.createCheckoutSession('org1', 'a@b.com', 'monthly', 'EUR');
    expect(result).toEqual(
      expect.objectContaining({ mode: 'redirect', url: 'https://checkout.stripe.com/test' }),
    );
    expect(stripeProvider.createCheckout).toHaveBeenCalled();
    expect(abacateProvider.createCheckout).not.toHaveBeenCalled();
  });

  it('routes BRL lifetime checkout to Abacate PIX', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      name: 'Acme',
      paymentProvider: null,
      deletedAt: null,
    });
    abacateProvider.createCheckout.mockResolvedValue({
      mode: 'pix',
      provider: 'ABACATE',
      brCode: '000201',
      brCodeBase64: 'data:image/png;base64,abc',
      externalPaymentId: 'pix_1',
      amountCentavos: 99700,
    });

    const result = await service.createCheckoutSession('org1', 'a@b.com', 'lifetime', 'BRL');
    expect(result.mode).toBe('pix');
    expect(abacateProvider.createCheckout).toHaveBeenCalled();
    expect(stripeProvider.createCheckout).not.toHaveBeenCalled();
  });

  it('rejects cross-provider checkout when org already bound', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      paymentProvider: 'STRIPE',
      planStatus: PlanStatus.ACTIVE,
      deletedAt: null,
    });
    await expect(
      service.createCheckoutSession('org1', 'a@b.com', 'lifetime', 'BRL'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects checkout when organization already has active lifetime', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.LIFETIME,
      planStatus: PlanStatus.ACTIVE,
      paymentProvider: 'ABACATE',
      deletedAt: null,
    });
    await expect(
      service.createCheckoutSession('org1', 'a@b.com', 'monthly', 'BRL'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(abacateProvider.createCheckout).not.toHaveBeenCalled();
    expect(stripeProvider.createCheckout).not.toHaveBeenCalled();
  });

  it('rejects invalid Stripe webhook signature', async () => {
    stripeProvider.verifyAndParseWebhook.mockRejectedValue(new BadRequestException('bad sig'));
    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('activates via Stripe webhook once (idempotent)', async () => {
    stripeProvider.verifyAndParseWebhook.mockResolvedValue({
      eventId: 'evt_1',
      type: 'checkout.session.completed',
      payload: { id: 'evt_1' },
    });
    stripeProvider.applyWebhookEvent.mockResolvedValue({
      handled: true,
      eventId: 'evt_1',
      type: 'checkout.session.completed',
    });

    await service.handleStripeWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });
    expect(prisma.billingWebhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: 'evt_1',
        type: 'checkout.session.completed',
      }),
    });
    expect(stripeProvider.applyWebhookEvent).toHaveBeenCalled();
  });

  it('ignores duplicate webhook events', async () => {
    stripeProvider.verifyAndParseWebhook.mockResolvedValue({
      eventId: 'evt_dup',
      type: 'checkout.session.completed',
      payload: { id: 'evt_dup' },
    });
    prisma.billingWebhookEvent.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' }),
    ).resolves.toEqual({ received: true });
    expect(stripeProvider.applyWebhookEvent).not.toHaveBeenCalled();
  });
});

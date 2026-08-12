import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgPlan, PlanStatus } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingActivationService } from './billing-activation.service';
import { BillingService } from './billing.service';
import { CreditPurchaseService } from './credit-purchase.service';
import { AbacatePaymentProvider } from './infrastructure/abacate.payment-provider';
import { StripePaymentProvider } from './infrastructure/stripe.payment-provider';

describe('BillingService', () => {
  let service: BillingService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    organization: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findFirstOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    search: {
      count: jest.fn(),
    },
    usageLedger: {
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    creditLedgerEntry: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    billingWebhookEvent: {
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  prisma.$transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma));

  const stripeProvider = {
    createCheckout: jest.fn(),
    createCreditCheckout: jest.fn(),
    createPortal: jest.fn(),
    verifyAndParseWebhook: jest.fn(),
    applyWebhookEvent: jest.fn(),
  };

  const abacateProvider = {
    createCheckout: jest.fn(),
    createCreditCheckout: jest.fn(),
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
        { provide: CreditPurchaseService, useValue: { createPending: jest.fn(), attachPayment: jest.fn() } },
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
    prisma.usageLedger.count.mockResolvedValue(3);
    await expect(service.assertCanCreateSearch('org1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reports remaining free searches in the billing status', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.FREE,
      planStatus: PlanStatus.INACTIVE,
      planCurrency: null,
      paymentProvider: null,
      currentPeriodEnd: null,
      deletedAt: null,
    });
    prisma.usageLedger.count.mockResolvedValue(2);

    await expect(service.getOrganizationBilling('org1')).resolves.toEqual(
      expect.objectContaining({
        searchUsage: { used: 2, limit: 3, remaining: 1, unlimited: false },
      }),
    );
  });

  it('reports unlimited searches for an active plan', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.STARTER_MONTHLY,
      planStatus: PlanStatus.ACTIVE,
      planCurrency: 'BRL',
      paymentProvider: null,
      currentPeriodEnd: null,
      deletedAt: null,
    });
    prisma.usageLedger.count.mockResolvedValue(12);

    await expect(service.getOrganizationBilling('org1')).resolves.toEqual(
      expect.objectContaining({
        searchUsage: { used: 12, limit: null, remaining: null, unlimited: true },
      }),
    );
  });

  it('routes card monthly checkout to Stripe redirect', async () => {
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

    const result = await service.createCheckoutSession(
      'org1',
      'a@b.com',
      'monthly',
      'BRL',
      'card',
    );
    expect(result).toEqual(
      expect.objectContaining({ mode: 'redirect', url: 'https://checkout.stripe.com/test' }),
    );
    expect(stripeProvider.createCheckout).toHaveBeenCalled();
    expect(abacateProvider.createCheckout).not.toHaveBeenCalled();
  });

  it('routes PIX lifetime checkout to Abacate', async () => {
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
      amountCentavos: 39900,
    });

    const result = await service.createCheckoutSession(
      'org1',
      'a@b.com',
      'lifetime',
      'BRL',
      'pix',
    );
    expect(result.mode).toBe('pix');
    expect(abacateProvider.createCheckout).toHaveBeenCalled();
    expect(stripeProvider.createCheckout).not.toHaveBeenCalled();
  });

  it('rejects cross-provider plan checkout when org already bound', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      paymentProvider: 'STRIPE',
      planStatus: PlanStatus.ACTIVE,
      deletedAt: null,
    });
    await expect(
      service.createCheckoutSession('org1', 'a@b.com', 'monthly', 'BRL', 'pix'),
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
      service.createCheckoutSession('org1', 'a@b.com', 'monthly', 'BRL', 'card'),
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

  it('releases webhook claim when apply fails so retries can succeed', async () => {
    stripeProvider.verifyAndParseWebhook.mockResolvedValue({
      eventId: 'evt_fail',
      type: 'checkout.session.completed',
      payload: { id: 'evt_fail' },
    });
        prisma.billingWebhookEvent.create.mockResolvedValue({});
stripeProvider.applyWebhookEvent.mockRejectedValue(new Error('db down'));

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' }),
    ).rejects.toThrow('db down');
    expect(prisma.billingWebhookEvent.delete).toHaveBeenCalledWith({
      where: {
        provider_eventId: {
          provider: 'STRIPE',
          eventId: 'evt_fail',
        },
      },
    });
  });

  it('allows a free organization to search when purchased credits remain', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1', plan: OrgPlan.FREE, planStatus: PlanStatus.INACTIVE, creditBalance: 2, deletedAt: null,
    });
    prisma.usageLedger.count.mockResolvedValue(3);
    await expect(service.assertCanCreateSearch('org1')).resolves.toBeUndefined();
  });

  it('records durable free-quota usage without debiting credits', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      planStatus: PlanStatus.INACTIVE,
      creditBalance: 5,
      deletedAt: null,
    });
    prisma.usageLedger.findUnique.mockResolvedValue(null);
    prisma.usageLedger.count.mockResolvedValue(2);
    prisma.usageLedger.create.mockResolvedValue({});

    await expect(service.consumeCreditForSearch('org1', 'search-1')).resolves.toBeUndefined();
    expect(prisma.usageLedger.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org1',
        meterKey: 'SEARCHES',
        amount: 1,
        idempotencyKey: 'search-usage:search-1',
      },
    });
    expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    expect(prisma.creditLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('still charges credits after searches were deleted (usage meter survives)', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      planStatus: PlanStatus.INACTIVE,
      creditBalance: 0,
      deletedAt: null,
    });
    // Live Search rows may be 0 after deletes, but durable usage is exhausted.
    prisma.search.count.mockResolvedValue(0);
    prisma.usageLedger.count.mockResolvedValue(3);
    await expect(service.assertCanCreateSearch('org1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('decrements balance and writes SEARCH_CONSUME + SEARCHES usage entries', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      planStatus: PlanStatus.INACTIVE,
      creditBalance: 4,
      deletedAt: null,
    });
    prisma.usageLedger.findUnique.mockResolvedValue(null);
    prisma.usageLedger.count.mockResolvedValue(4);
    prisma.creditLedgerEntry.findUnique.mockResolvedValue(null);
    prisma.organization.updateMany.mockResolvedValue({ count: 1 });
    prisma.organization.findFirstOrThrow.mockResolvedValue({ creditBalance: 3 });
    prisma.creditLedgerEntry.create.mockResolvedValue({});
    prisma.usageLedger.create.mockResolvedValue({});

    await expect(service.consumeCreditForSearch('org1', 'search-42')).resolves.toBeUndefined();

    expect(prisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: 'org1', creditBalance: { gte: 1 } },
      data: { creditBalance: { decrement: 1 } },
    });
    expect(prisma.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org1',
        reason: 'SEARCH_CONSUME',
        delta: -1,
        balanceAfter: 3,
        searchId: 'search-42',
        idempotencyKey: 'search-consume:search-42',
      },
    });
    expect(prisma.usageLedger.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org1',
        meterKey: 'SEARCHES',
        amount: 1,
        idempotencyKey: 'search-usage:search-42',
      },
    });
  });

  it('is idempotent when the search already has a usage ledger entry', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      planStatus: PlanStatus.INACTIVE,
      creditBalance: 1,
      deletedAt: null,
    });
    prisma.usageLedger.findUnique.mockResolvedValue({ id: 'usage-1' });

    await expect(service.consumeCreditForSearch('org1', 'search-42')).resolves.toBeUndefined();
    expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    expect(prisma.creditLedgerEntry.create).not.toHaveBeenCalled();
    expect(prisma.usageLedger.create).not.toHaveBeenCalled();
  });
});

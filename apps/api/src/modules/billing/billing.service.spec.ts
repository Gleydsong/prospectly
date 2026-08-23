import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgPlan, PaymentProvider, PlanStatus } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingActivationService } from './billing-activation.service';
import { BillingService } from './billing.service';
import { CreditPurchaseService } from './credit-purchase.service';
import { EntitlementService } from './entitlement.service';
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
    opportunityRun: {
      count: jest.fn(),
    },
    creditLedgerEntry: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    billingWebhookEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
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

  const creditPurchases = {
    createPending: jest.fn(),
    attachPayment: jest.fn(),
  };

  const activation = {
    syncMonthlyStatus: jest.fn().mockResolvedValue(undefined),
  };

  const entitlements = {
    canExportCsv: jest.fn().mockResolvedValue(false),
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
    prisma.opportunityRun.count.mockResolvedValue(0);
    prisma.billingWebhookEvent.findUnique.mockResolvedValue(null);
    prisma.billingWebhookEvent.create.mockResolvedValue({});
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: BillingActivationService, useValue: activation },
        { provide: StripePaymentProvider, useValue: stripeProvider },
        { provide: AbacatePaymentProvider, useValue: abacateProvider },
        { provide: CreditPurchaseService, useValue: creditPurchases },
        { provide: EntitlementService, useValue: entitlements },
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
    prisma.search.count.mockResolvedValue(2);

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
    prisma.search.count.mockResolvedValue(12);

    await expect(service.getOrganizationBilling('org1')).resolves.toEqual(
      expect.objectContaining({
        searchUsage: { used: 12, limit: null, remaining: null, unlimited: true },
      }),
    );
  });

  it('redacts billing admin flags for VIEWER', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.STARTER_MONTHLY,
      planStatus: PlanStatus.ACTIVE,
      planCurrency: 'BRL',
      paymentProvider: PaymentProvider.STRIPE,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      currentPeriodEnd: null,
      deletedAt: null,
      creditBalance: 10,
    });
    prisma.search.count.mockResolvedValue(1);

    await expect(service.getOrganizationBilling('org1', 'VIEWER')).resolves.toEqual(
      expect.objectContaining({
        creditBalance: 10,
        legacyStripeSubscription: false,
        canOpenPortal: false,
        canCancelSubscription: false,
      }),
    );
  });

  it('keeps billing admin flags for OWNER', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.STARTER_MONTHLY,
      planStatus: PlanStatus.ACTIVE,
      planCurrency: 'BRL',
      paymentProvider: PaymentProvider.STRIPE,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      currentPeriodEnd: null,
      deletedAt: null,
      creditBalance: 10,
    });
    prisma.search.count.mockResolvedValue(1);

    await expect(service.getOrganizationBilling('org1', 'OWNER')).resolves.toEqual(
      expect.objectContaining({
        legacyStripeSubscription: true,
        canOpenPortal: true,
        canCancelSubscription: false,
        monthlyCardEnabled: false,
      }),
    );
  });

  it('exposes monthlyCardEnabled when the monthly product id is configured', async () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'abacate.productMonthlyBrl') return 'prod_monthly';
      return undefined;
    });
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.FREE,
      planStatus: PlanStatus.INACTIVE,
      planCurrency: null,
      paymentProvider: null,
      currentPeriodEnd: null,
      deletedAt: null,
    });
    prisma.search.count.mockResolvedValue(0);

    await expect(service.getOrganizationBilling('org1', 'OWNER')).resolves.toEqual(
      expect.objectContaining({ monthlyCardEnabled: true }),
    );
  });

  it('routes card monthly checkout to AbacatePay redirect', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      name: 'Acme',
      stripeCustomerId: 'cus_1',
      paymentProvider: null,
      deletedAt: null,
    });
    abacateProvider.createCheckout.mockResolvedValue({
      mode: 'redirect',
      url: 'https://app.abacatepay.com/pay/bill_1',
      provider: 'ABACATE',
      externalCheckoutId: 'bill_1',
    });

    const result = await service.createCheckoutSession(
      'org1',
      'a@b.com',
      'monthly',
      'BRL',
      'card',
    );
    expect(result).toEqual(
      expect.objectContaining({ mode: 'redirect', url: 'https://app.abacatepay.com/pay/bill_1' }),
    );
    expect(abacateProvider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethod: 'card' }),
    );
    expect(stripeProvider.createCheckout).not.toHaveBeenCalled();
  });

  it('rejects new lifetime checkouts', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      name: 'Acme',
      paymentProvider: null,
      deletedAt: null,
    });

    await expect(
      service.createCheckoutSession('org1', 'a@b.com', 'lifetime', 'BRL', 'pix'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(abacateProvider.createCheckout).not.toHaveBeenCalled();
  });

  it('allows PIX monthly cancel without an Abacate subscription id', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.STARTER_MONTHLY,
      planStatus: PlanStatus.ACTIVE,
      planCurrency: 'BRL',
      paymentProvider: PaymentProvider.ABACATE,
      abacateSubscriptionId: null,
      currentPeriodEnd: new Date('2026-09-14T00:00:00.000Z'),
      deletedAt: null,
      creditBalance: 0,
    });
    prisma.search.count.mockResolvedValue(1);

    await expect(service.getOrganizationBilling('org1', 'OWNER')).resolves.toEqual(
      expect.objectContaining({ canCancelSubscription: true, canOpenPortal: false }),
    );
  });

  it('expires an overdue monthly plan before allowing more unlimited searches', async () => {
    const expired = {
      id: 'org1',
      plan: OrgPlan.STARTER_MONTHLY,
      planStatus: PlanStatus.ACTIVE,
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
      creditBalance: 0,
      deletedAt: null,
    };
    prisma.organization.findFirst
      .mockResolvedValueOnce(expired)
      .mockResolvedValueOnce({
        ...expired,
        plan: OrgPlan.FREE,
        planStatus: PlanStatus.CANCELED,
      });
    prisma.search.count.mockResolvedValue(3);

    await expect(service.assertCanCreateSearch('org1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(activation.syncMonthlyStatus).toHaveBeenCalledWith({
      organizationId: 'org1',
      status: PlanStatus.CANCELED,
    });
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

  it('allows a canceled Stripe org to start an AbacatePay plan', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      name: 'Acme',
      paymentProvider: PaymentProvider.STRIPE,
      planStatus: PlanStatus.CANCELED,
      stripeCustomerId: 'cus_1',
      deletedAt: null,
    });
    abacateProvider.createCheckout.mockResolvedValue({
      mode: 'redirect',
      provider: 'ABACATE',
      url: 'https://app.abacatepay.com/pay/bill_new',
    });
    await expect(
      service.createCheckoutSession('org1', 'a@b.com', 'monthly', 'BRL', 'card'),
    ).resolves.toEqual(expect.objectContaining({ provider: 'ABACATE' }));
    expect(stripeProvider.createCheckout).not.toHaveBeenCalled();
  });

  it('allows AbacatePay credit checkout while a Stripe plan is active', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      paymentProvider: PaymentProvider.STRIPE,
      planStatus: PlanStatus.ACTIVE,
      deletedAt: null,
    });
    creditPurchases.createPending.mockResolvedValue({ id: 'purchase_1' });
    abacateProvider.createCreditCheckout.mockResolvedValue({
      mode: 'redirect',
      provider: 'ABACATE',
      url: 'https://app.abacatepay.com/pay/bill_credits',
    });
    await expect(
      service.createCreditCheckoutSession('org1', 'credits-2000', 'card'),
    ).resolves.toEqual(expect.objectContaining({ provider: 'ABACATE' }));
    expect(stripeProvider.createCreditCheckout).not.toHaveBeenCalled();
    expect(creditPurchases.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ provider: PaymentProvider.ABACATE, paymentMethod: 'card' }),
    );
  });

  it('keeps the Stripe portal for legacy organizations', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      paymentProvider: PaymentProvider.STRIPE,
      stripeCustomerId: 'cus_1',
      deletedAt: null,
    });
    stripeProvider.createPortal.mockResolvedValue({ url: 'https://billing.stripe.com/p/session' });
    await expect(service.createPortalSession('org1')).resolves.toEqual({
      url: 'https://billing.stripe.com/p/session',
    });
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
        status: 'PROCESSING',
      }),
    });
    expect(stripeProvider.applyWebhookEvent).toHaveBeenCalled();
    expect(prisma.billingWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PROCESSED' }),
      }),
    );
  });

  it('ignores duplicate webhook events', async () => {
    stripeProvider.verifyAndParseWebhook.mockResolvedValue({
      eventId: 'evt_dup',
      type: 'checkout.session.completed',
      payload: { id: 'evt_dup' },
    });
    prisma.billingWebhookEvent.findUnique.mockResolvedValue({
      status: 'PROCESSED',
      updatedAt: new Date(),
      attempts: 1,
    });

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' }),
    ).resolves.toEqual({ received: true });
    expect(stripeProvider.applyWebhookEvent).not.toHaveBeenCalled();
  });

  it('marks webhook FAILED when apply fails so retries can succeed', async () => {
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
    expect(prisma.billingWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', lastError: 'db down' }),
      }),
    );
  });

  it('allows a free organization to search when purchased credits remain', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1', plan: OrgPlan.FREE, planStatus: PlanStatus.INACTIVE, creditBalance: 14, deletedAt: null,
    });
    prisma.search.count.mockResolvedValue(3);
    await expect(service.assertCanCreateSearch('org1')).resolves.toBeUndefined();
  });

  it('blocks Maps search when remaining credits are below 14', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1', plan: OrgPlan.FREE, planStatus: PlanStatus.INACTIVE, creditBalance: 13, deletedAt: null,
    });
    prisma.search.count.mockResolvedValue(3);
    await expect(service.assertCanCreateSearch('org1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks Opportunity Finder when remaining credits are below 16', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1', plan: OrgPlan.FREE, planStatus: PlanStatus.INACTIVE, creditBalance: 15, deletedAt: null,
    });
    prisma.search.count.mockResolvedValue(3);
    await expect(service.assertCanCreateSearch('org1', 16)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('skips credit consume while still within free search quota', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      planStatus: PlanStatus.INACTIVE,
      creditBalance: 5,
      deletedAt: null,
    });
    prisma.search.count.mockResolvedValue(2);

    await expect(service.consumeCreditForSearch('org1', 'search-1')).resolves.toBeUndefined();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('decrements 14 credits and writes a SEARCH_CONSUME ledger entry', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      planStatus: PlanStatus.INACTIVE,
      creditBalance: 20,
      deletedAt: null,
    });
    prisma.search.count.mockResolvedValue(4);
    prisma.creditLedgerEntry.findUnique.mockResolvedValue(null);
    prisma.organization.updateMany.mockResolvedValue({ count: 1 });
    prisma.organization.findFirstOrThrow.mockResolvedValue({ creditBalance: 6 });
    prisma.creditLedgerEntry.create.mockResolvedValue({});

    await expect(service.consumeCreditForSearch('org1', 'search-42')).resolves.toBeUndefined();

    expect(prisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: 'org1', creditBalance: { gte: 14 } },
      data: { creditBalance: { decrement: 14 } },
    });
    expect(prisma.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org1',
        reason: 'SEARCH_CONSUME',
        delta: -14,
        balanceAfter: 6,
        searchId: 'search-42',
        idempotencyKey: 'search-consume:search-42',
      },
    });
  });

  it('is idempotent when the search already has a consume ledger entry', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      planStatus: PlanStatus.INACTIVE,
      creditBalance: 1,
      deletedAt: null,
    });
    prisma.search.count.mockResolvedValue(5);
    prisma.creditLedgerEntry.findUnique.mockResolvedValue({ id: 'ledger-1' });

    await expect(service.consumeCreditForSearch('org1', 'search-42')).resolves.toBeUndefined();
    expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    expect(prisma.creditLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('decrements 16 credits for an Opportunity Finder run after the free quota', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      planStatus: PlanStatus.INACTIVE,
      creditBalance: 40,
      deletedAt: null,
    });
    prisma.search.count.mockResolvedValue(2);
    prisma.opportunityRun.count.mockResolvedValue(2);
    prisma.creditLedgerEntry.findUnique.mockResolvedValue(null);
    prisma.organization.updateMany.mockResolvedValue({ count: 1 });
    prisma.organization.findFirstOrThrow.mockResolvedValue({ creditBalance: 24 });
    prisma.creditLedgerEntry.create.mockResolvedValue({});

    await expect(service.consumeCreditForOpportunityRun('org1', 'run-9')).resolves.toBeUndefined();

    expect(prisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: 'org1', creditBalance: { gte: 16 } },
      data: { creditBalance: { decrement: 16 } },
    });
    expect(prisma.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org1',
        reason: 'AI_CONSUME',
        delta: -16,
        balanceAfter: 24,
        opportunityRunId: 'run-9',
        idempotencyKey: 'opportunity-consume:run-9',
        metadata: { feature: 'AI_OPPORTUNITY_FINDER' },
      },
    });
  });

  it('charges 8 credits to regenerate an explanation outside the free quota', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      planStatus: PlanStatus.INACTIVE,
      creditBalance: 10,
      deletedAt: null,
    });
    prisma.creditLedgerEntry.findUnique.mockResolvedValue(null);
    prisma.organization.updateMany.mockResolvedValue({ count: 1 });
    prisma.organization.findFirstOrThrow.mockResolvedValue({ creditBalance: 2 });
    prisma.creditLedgerEntry.create.mockResolvedValue({});

    await expect(service.consumeCreditForExplain('org1', 'cand-1', 'run-1')).resolves.toBeUndefined();

    expect(prisma.search.count).not.toHaveBeenCalled();
    expect(prisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: 'org1', creditBalance: { gte: 8 } },
      data: { creditBalance: { decrement: 8 } },
    });
    expect(prisma.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: 'AI_CONSUME',
        delta: -8,
        idempotencyKey: 'explain-consume:cand-1',
        metadata: { feature: 'EXPLAIN', candidateId: 'cand-1' },
      }),
    });
  });

  it('charges 1 credit to save a lead', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      planStatus: PlanStatus.INACTIVE,
      creditBalance: 5,
      deletedAt: null,
    });
    prisma.creditLedgerEntry.findUnique.mockResolvedValue(null);
    prisma.organization.updateMany.mockResolvedValue({ count: 1 });
    prisma.organization.findFirstOrThrow.mockResolvedValue({ creditBalance: 4 });
    prisma.creditLedgerEntry.create.mockResolvedValue({});

    await expect(service.consumeCreditForSaveLead('org1', 'cand-2', 'run-1')).resolves.toBeUndefined();

    expect(prisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: 'org1', creditBalance: { gte: 1 } },
      data: { creditBalance: { decrement: 1 } },
    });
  });

  it('refunds the consumed Opportunity Finder amount on failure', async () => {
    prisma.creditLedgerEntry.findUnique
      .mockResolvedValueOnce({ id: 'consume-1', delta: -16, createdAt: new Date('2026-01-01T00:00:00Z') })
      .mockResolvedValueOnce(null);
    prisma.organization.update.mockResolvedValue({ creditBalance: 30 });
    prisma.creditLedgerEntry.delete.mockResolvedValue({});
    prisma.creditLedgerEntry.create.mockResolvedValue({});

    await expect(service.refundOpportunityRunCredit('org1', 'run-9', 'NO_COMPANIES_FOUND')).resolves.toBeUndefined();

    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org1' },
      data: { creditBalance: { increment: 16 } },
      select: { creditBalance: true },
    });
    expect(prisma.creditLedgerEntry.delete).toHaveBeenCalledWith({ where: { id: 'consume-1' } });
    expect(prisma.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: 'REFUND',
        delta: 16,
        opportunityRunId: 'run-9',
        idempotencyKey: 'opportunity-refund:run-9',
        metadata: { feature: 'AI_OPPORTUNITY_FINDER', cause: 'NO_COMPANIES_FOUND' },
      }),
    });
  });

  it('re-charges explain after a prior consume was refunded', async () => {
    const consumedAt = new Date('2026-01-01T00:00:00Z');
    const refundedAt = new Date('2026-01-01T00:01:00Z');
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      planStatus: PlanStatus.INACTIVE,
      creditBalance: 10,
      deletedAt: null,
    });
    prisma.creditLedgerEntry.findUnique
      .mockResolvedValueOnce({ id: 'consume-1', createdAt: consumedAt })
      .mockResolvedValueOnce({ id: 'refund-1', createdAt: refundedAt });
    prisma.creditLedgerEntry.delete.mockResolvedValue({});
    prisma.organization.updateMany.mockResolvedValue({ count: 1 });
    prisma.organization.findFirstOrThrow.mockResolvedValue({ creditBalance: 2 });
    prisma.creditLedgerEntry.create.mockResolvedValue({});

    await expect(service.consumeCreditForExplain('org1', 'cand-1', 'run-1')).resolves.toBeUndefined();

    expect(prisma.creditLedgerEntry.delete).toHaveBeenCalledWith({ where: { id: 'consume-1' } });
    expect(prisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: 'org1', creditBalance: { gte: 8 } },
      data: { creditBalance: { decrement: 8 } },
    });
    expect(prisma.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idempotencyKey: 'explain-consume:cand-1',
        delta: -8,
      }),
    });
  });

  it('re-charges save-lead after a prior consume was refunded', async () => {
    const consumedAt = new Date('2026-01-01T00:00:00Z');
    const refundedAt = new Date('2026-01-01T00:01:00Z');
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      planStatus: PlanStatus.INACTIVE,
      creditBalance: 3,
      deletedAt: null,
    });
    prisma.creditLedgerEntry.findUnique
      .mockResolvedValueOnce({ id: 'consume-2', createdAt: consumedAt })
      .mockResolvedValueOnce({ id: 'refund-2', createdAt: refundedAt });
    prisma.creditLedgerEntry.delete.mockResolvedValue({});
    prisma.organization.updateMany.mockResolvedValue({ count: 1 });
    prisma.organization.findFirstOrThrow.mockResolvedValue({ creditBalance: 2 });
    prisma.creditLedgerEntry.create.mockResolvedValue({});

    await expect(service.consumeCreditForSaveLead('org1', 'cand-2', 'run-1')).resolves.toBeUndefined();

    expect(prisma.creditLedgerEntry.delete).toHaveBeenCalledWith({ where: { id: 'consume-2' } });
    expect(prisma.organization.updateMany).toHaveBeenCalled();
  });

  it('does not double-refund when the refund ledger already covers the consume', async () => {
    const consumedAt = new Date('2026-01-01T00:00:00Z');
    const refundedAt = new Date('2026-01-01T00:01:00Z');
    prisma.creditLedgerEntry.findUnique
      .mockResolvedValueOnce({ id: 'consume-1', delta: -8, createdAt: consumedAt })
      .mockResolvedValueOnce({ id: 'refund-1', createdAt: refundedAt });

    await expect(service.refundExplainCredit('org1', 'cand-1')).resolves.toBeUndefined();

    expect(prisma.organization.update).not.toHaveBeenCalled();
    expect(prisma.creditLedgerEntry.delete).not.toHaveBeenCalled();
    expect(prisma.creditLedgerEntry.create).not.toHaveBeenCalled();
  });
});

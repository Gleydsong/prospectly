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
import { AppmaxPaymentService } from './appmax-payment.service';

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
    },
    billingWebhookEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  prisma.$transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma));

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

  const appmaxPayments = {
    createCardCheckout: jest.fn(),
    getBrowserConfig: jest.fn(),
    getHealthCheck: jest.fn(),
    acceptWebhook: jest.fn(),
    cancelSubscription: jest.fn(),
  };

  const entitlements = {
    canExportCsv: jest.fn().mockResolvedValue(false),
  };

  const readConfig = (key: string) => {
    const map: Record<string, string | boolean> = {
      'appmax.enabled': false,
      'abacate.successUrl': 'https://app.test/success',
      'abacate.cancelUrl': 'https://app.test/cancel',
      frontendUrl: 'https://app.test',
    };
    return map[key];
  };
  const configGet = jest.fn(readConfig);

  beforeEach(async () => {
    jest.clearAllMocks();
    configGet.mockImplementation(readConfig);
    prisma.opportunityRun.count.mockResolvedValue(0);
    prisma.billingWebhookEvent.findUnique.mockResolvedValue(null);
    prisma.billingWebhookEvent.create.mockResolvedValue({});
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: BillingActivationService, useValue: activation },
        { provide: AppmaxPaymentService, useValue: appmaxPayments },
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

  it('only lets billing administrators cancel an Appmax subscription', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.STARTER_MONTHLY,
      planStatus: PlanStatus.ACTIVE,
      planCurrency: 'BRL',
      paymentProvider: PaymentProvider.APPMAX,
      appmaxSubscriptionId: 'sub_1',
      currentPeriodEnd: null,
      deletedAt: null,
      creditBalance: 10,
    });
    prisma.search.count.mockResolvedValue(1);

    await expect(service.getOrganizationBilling('org1', 'VIEWER')).resolves.toEqual(
      expect.objectContaining({ canCancelSubscription: false }),
    );
    await expect(service.getOrganizationBilling('org1', 'OWNER')).resolves.toEqual(
      expect.objectContaining({ canCancelSubscription: true }),
    );
  });

  it('exposes monthlyCardEnabled when the monthly product id is configured', async () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'appmax.enabled') return true;
      if (
        [
          'appmax.clientId',
          'appmax.clientSecret',
          'appmax.externalId',
          'appmax.appId',
          'appmax.siteId',
        ].includes(key)
      )
        return 'configured';
      if (key === 'appmax.monthlyProductId') return '55';
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
      expect.objectContaining({ cardEnabled: true, monthlyCardEnabled: true }),
    );
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
      expect.objectContaining({ canCancelSubscription: true }),
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
    prisma.organization.findFirst.mockResolvedValueOnce(expired).mockResolvedValueOnce({
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
  });

  it('delegates a credit-card checkout to Appmax with authenticated tenant context', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.FREE,
      paymentProvider: null,
      planStatus: PlanStatus.INACTIVE,
      deletedAt: null,
    });
    const dto = {
      checkoutKey: 'f191b5ef-31b8-4c79-96c7-b233b522eb27',
      purpose: 'credits' as const,
      offer: 'credits-2000' as const,
      firstName: 'Ana',
      lastName: 'Silva',
      email: 'ana@example.com',
      phone: '11999999999',
      ip: '203.0.113.10',
      cardToken: 'tokenized-card',
      documentNumber: '12345678909',
      holderName: 'ANA SILVA',
    };
    appmaxPayments.createCardCheckout.mockResolvedValue({
      mode: 'pending',
      provider: 'APPMAX',
      externalCheckoutId: 'order-1',
    });

    await expect(service.createAppmaxCardCheckout('org1', 'ana@example.com', dto)).resolves.toEqual(
      expect.objectContaining({ provider: 'APPMAX' }),
    );
    expect(appmaxPayments.createCardCheckout).toHaveBeenCalledWith({
      ...dto,
      organizationId: 'org1',
      authenticatedEmail: 'ana@example.com',
    });
  });

  it('blocks a second monthly checkout while a historical Stripe subscription is active', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      paymentProvider: PaymentProvider.STRIPE,
      planStatus: PlanStatus.ACTIVE,
      deletedAt: null,
    });
    const dto = {
      checkoutKey: 'f191b5ef-31b8-4c79-96c7-b233b522eb27',
      purpose: 'monthly' as const,
      firstName: 'Ana',
      lastName: 'Silva',
      email: 'ana@example.com',
      phone: '11999999999',
      ip: '203.0.113.10',
      cardToken: 'tokenized-card',
      documentNumber: '12345678909',
      holderName: 'ANA SILVA',
    };

    await expect(
      service.createAppmaxCardCheckout('org1', 'ana@example.com', dto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(appmaxPayments.createCardCheckout).not.toHaveBeenCalled();
  });

  it('delegates Appmax webhooks without interpreting their unsigned payload', async () => {
    const body = Buffer.from('{"event":"order_approved","data":{"order_id":123}}');
    appmaxPayments.acceptWebhook.mockResolvedValue({ received: true });

    await expect(service.handleAppmaxWebhook(body)).resolves.toEqual({ received: true });
    expect(appmaxPayments.acceptWebhook).toHaveBeenCalledWith(body);
  });

  it('allows a free organization to search when purchased credits remain', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.FREE,
      planStatus: PlanStatus.INACTIVE,
      creditBalance: 14,
      deletedAt: null,
    });
    prisma.search.count.mockResolvedValue(3);
    await expect(service.assertCanCreateSearch('org1')).resolves.toBeUndefined();
  });

  it('blocks Maps search when remaining credits are below 14', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.FREE,
      planStatus: PlanStatus.INACTIVE,
      creditBalance: 13,
      deletedAt: null,
    });
    prisma.search.count.mockResolvedValue(3);
    await expect(service.assertCanCreateSearch('org1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks Opportunity Finder when remaining credits are below 16', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.FREE,
      planStatus: PlanStatus.INACTIVE,
      creditBalance: 15,
      deletedAt: null,
    });
    prisma.search.count.mockResolvedValue(3);
    await expect(service.assertCanCreateSearch('org1', 16)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
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

    await expect(
      service.consumeCreditForExplain('org1', 'cand-1', 'run-1'),
    ).resolves.toBeUndefined();

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

    await expect(
      service.consumeCreditForSaveLead('org1', 'cand-2', 'run-1'),
    ).resolves.toBeUndefined();

    expect(prisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: 'org1', creditBalance: { gte: 1 } },
      data: { creditBalance: { decrement: 1 } },
    });
  });

  it('refunds the consumed Opportunity Finder amount on failure', async () => {
    prisma.creditLedgerEntry.findUnique
      .mockResolvedValueOnce({ delta: -16 })
      .mockResolvedValueOnce(null);
    prisma.organization.update.mockResolvedValue({ creditBalance: 30 });
    prisma.creditLedgerEntry.create.mockResolvedValue({});

    await expect(
      service.refundOpportunityRunCredit('org1', 'run-9', 'NO_COMPANIES_FOUND'),
    ).resolves.toBeUndefined();

    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org1' },
      data: { creditBalance: { increment: 16 } },
      select: { creditBalance: true },
    });
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
});

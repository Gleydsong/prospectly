import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgPlan, PaymentProvider, PlanStatus } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingActivationService } from './billing-activation.service';
import { BillingService } from './billing.service';
import { CreditPurchaseService } from './credit-purchase.service';
import { EntitlementService } from './entitlement.service';
import { MonthlyCheckoutAttemptService } from './monthly-checkout-attempt.service';
import { AbacatePaymentProvider } from './infrastructure/abacate.payment-provider';
import { AsaasClient, AsaasRequestError } from './infrastructure/asaas.client';

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
    billingProfile: {
      findUnique: jest.fn(),
    },
    creditPurchase: {
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    monthlyCheckoutAttempt: {
      findFirst: jest.fn(),
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
    beginAsaasPackage: jest.fn(),
    attachPayment: jest.fn(),
  };

  const asaasClient = {
    createHostedPayment: jest.fn(),
    createPixPayment: jest.fn(),
    getPixQrCode: jest.fn(),
    createRecurringCheckout: jest.fn(),
    cancelSubscription: jest.fn(),
  };

  const monthlyAttempts = {
    beginCard: jest.fn(),
    beginPix: jest.fn(),
    markReady: jest.fn(),
    markPixReady: jest.fn(),
    markFailed: jest.fn(),
    markReviewRequired: jest.fn(),
  };

  const activation = {
    syncMonthlyStatus: jest.fn().mockResolvedValue(undefined),
  };

  const entitlements = {
    canExportCsv: jest.fn().mockResolvedValue(false),
  };

  const readConfig = (key: string) => {
    const map: Record<string, string | boolean> = {
      'abacate.successUrl': 'https://app.test/success',
      'abacate.cancelUrl': 'https://app.test/cancel',
      frontendUrl: 'https://app.test',
      'asaas.enabled': true,
      'billing.pixProvider': 'ABACATE',
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
    prisma.creditPurchase.findFirst.mockResolvedValue(null);
    prisma.monthlyCheckoutAttempt.findFirst.mockResolvedValue(null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: BillingActivationService, useValue: activation },
        { provide: AbacatePaymentProvider, useValue: abacateProvider },
        { provide: AsaasClient, useValue: asaasClient },
        { provide: CreditPurchaseService, useValue: creditPurchases },
        { provide: EntitlementService, useValue: entitlements },
        { provide: MonthlyCheckoutAttemptService, useValue: monthlyAttempts },
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

  it('only lets billing administrators cancel an Abacate subscription', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.STARTER_MONTHLY,
      planStatus: PlanStatus.ACTIVE,
      planCurrency: 'BRL',
      paymentProvider: PaymentProvider.ABACATE,
      abacateSubscriptionId: 'sub_1',
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

  it('does not expire an Asaas card subscription when the invoice period lapses', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.STARTER_MONTHLY,
      planStatus: PlanStatus.ACTIVE,
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
      asaasSubscriptionId: 'sub_asaas_card',
      creditBalance: 0,
      deletedAt: null,
    });
    prisma.search.count.mockResolvedValue(3);

    await expect(service.assertCanCreateSearch('org1')).resolves.toBeUndefined();
    expect(activation.syncMonthlyStatus).not.toHaveBeenCalled();
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

  it('creates a hosted Asaas card checkout for a credit package', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.FREE,
      paymentProvider: null,
      planStatus: PlanStatus.INACTIVE,
      deletedAt: null,
    });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    creditPurchases.beginAsaasPackage.mockResolvedValue({
      created: true,
      purchase: { id: 'purchase-1' },
    });
    asaasClient.createHostedPayment.mockResolvedValue({
      id: 'pay_1',
      url: 'https://sandbox.asaas.com/i/pay_1',
    });

    await expect(
      service.createCreditCheckoutSession('org1', 'credits-2000', 'card'),
    ).resolves.toEqual({
      mode: 'redirect',
      provider: 'ASAAS',
      url: 'https://sandbox.asaas.com/i/pay_1',
      externalCheckoutId: 'pay_1',
    });
    expect(creditPurchases.beginAsaasPackage).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org1', offer: 'credits-2000' }),
    );
    expect(creditPurchases.attachPayment).toHaveBeenCalledWith(
      'purchase-1',
      'pay_1',
      'https://sandbox.asaas.com/i/pay_1',
    );
  });

  it('creates an Asaas PIX charge for a credit package after persisting the attempt', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'billing.pixProvider' ? 'ASAAS' : readConfig(key),
    );
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.FREE,
      paymentProvider: null,
      planStatus: PlanStatus.INACTIVE,
      deletedAt: null,
    });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    creditPurchases.beginAsaasPackage.mockResolvedValue({
      created: true,
      purchase: { id: 'purchase-pix-1' },
    });
    asaasClient.createPixPayment.mockResolvedValue({ id: 'pay_pix_1', status: 'PENDING' });
    asaasClient.getPixQrCode.mockResolvedValue({
      payload: '000201010212pix-copy-paste',
      encodedImage: 'cG5nLWJhc2U2NA==',
      expirationDate: '2026-08-29T23:59:59Z',
    });

    await expect(
      service.createCreditCheckoutSession('org1', 'credits-2000', 'pix'),
    ).resolves.toEqual({
      mode: 'pix',
      provider: 'ASAAS',
      brCode: '000201010212pix-copy-paste',
      brCodeBase64: 'cG5nLWJhc2U2NA==',
      externalPaymentId: 'pay_pix_1',
      amountCentavos: 1499,
      expiresAt: '2026-08-29T23:59:59Z',
    });
    expect(creditPurchases.beginAsaasPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        offer: 'credits-2000',
        paymentMethod: 'pix',
      }),
    );
    expect(creditPurchases.attachPayment).toHaveBeenCalledWith('purchase-pix-1', 'pay_pix_1');
    expect(creditPurchases.attachPayment.mock.invocationCallOrder[0]).toBeLessThan(
      asaasClient.getPixQrCode.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
    expect(abacateProvider.createCreditCheckout).not.toHaveBeenCalled();
  });

  it('reuses the persisted Asaas PIX payment instead of creating another charge', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'billing.pixProvider' ? 'ASAAS' : readConfig(key),
    );
    prisma.organization.findFirst.mockResolvedValue({ id: 'org1', deletedAt: null });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    creditPurchases.beginAsaasPackage.mockResolvedValue({
      created: false,
      purchase: {
        id: 'purchase-pix-1',
        offer: 'credits-2000',
        paymentMethod: 'PIX',
        status: 'PENDING',
        externalPaymentId: 'pay_pix_1',
      },
    });
    asaasClient.getPixQrCode.mockResolvedValue({
      payload: 'pix-copy-paste',
      encodedImage: 'cG5n',
    });

    await expect(
      service.createCreditCheckoutSession('org1', 'credits-2000', 'pix'),
    ).resolves.toMatchObject({
      mode: 'pix',
      provider: 'ASAAS',
      externalPaymentId: 'pay_pix_1',
    });
    expect(asaasClient.createPixPayment).not.toHaveBeenCalled();
    expect(asaasClient.getPixQrCode).toHaveBeenCalledWith('pay_pix_1');
  });

  it('reuses the persisted hosted package URL after the browser loses the response', async () => {
    prisma.organization.findFirst.mockResolvedValue({ id: 'org1', deletedAt: null });
    creditPurchases.beginAsaasPackage.mockResolvedValue({
      created: false,
      purchase: {
        id: 'purchase-1',
        offer: 'credits-2000',
        paymentMethod: 'CARD',
        status: 'PENDING',
        externalPaymentId: 'pay_1',
        checkoutUrl: 'https://sandbox.asaas.com/i/pay_1',
      },
    });

    await expect(
      service.createCreditCheckoutSession('org1', 'credits-2000', 'card'),
    ).resolves.toEqual({
      mode: 'redirect',
      provider: 'ASAAS',
      url: 'https://sandbox.asaas.com/i/pay_1',
      externalCheckoutId: 'pay_1',
    });
    expect(asaasClient.createHostedPayment).not.toHaveBeenCalled();
  });

  it('marks an ambiguous Asaas package request for review and shows the required message', async () => {
    prisma.organization.findFirst.mockResolvedValue({ id: 'org1', deletedAt: null });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    creditPurchases.beginAsaasPackage.mockResolvedValue({
      created: true,
      purchase: { id: 'purchase-ambiguous' },
    });
    asaasClient.createHostedPayment.mockRejectedValue(new AsaasRequestError(true));

    await expect(
      service.createCreditCheckoutSession('org1', 'credits-2000', 'card'),
    ).rejects.toMatchObject({
      status: 503,
      message: 'Estamos confirmando seu checkout',
    });
    expect(prisma.creditPurchase.update).toHaveBeenCalledWith({
      where: { id: 'purchase-ambiguous' },
      data: { status: 'REVIEW_REQUIRED' },
    });
  });

  it('marks a deterministic Asaas package rejection as failed instead of uncertain', async () => {
    prisma.organization.findFirst.mockResolvedValue({ id: 'org1', deletedAt: null });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    creditPurchases.beginAsaasPackage.mockResolvedValue({
      created: true,
      purchase: { id: 'purchase-rejected' },
    });
    asaasClient.createHostedPayment.mockRejectedValue(new AsaasRequestError(false));

    await expect(
      service.createCreditCheckoutSession('org1', 'credits-2000', 'card'),
    ).rejects.toMatchObject({ status: 503 });
    expect(prisma.creditPurchase.update).toHaveBeenCalledWith({
      where: { id: 'purchase-rejected' },
      data: { status: 'FAILED' },
    });
  });

  it('returns the Asaas PIX rejection instead of locking the organization in review', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'billing.pixProvider' ? 'ASAAS' : readConfig(key),
    );
    prisma.organization.findFirst.mockResolvedValue({ id: 'org1', deletedAt: null });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    creditPurchases.beginAsaasPackage.mockResolvedValue({
      created: true,
      purchase: { id: 'purchase-pix-rejected' },
    });
    asaasClient.createPixPayment.mockRejectedValue(
      new BadRequestException(
        'O Pix não está disponível no momento. Para utilizá-lo, sua conta precisa estar aprovada.',
      ),
    );

    await expect(
      service.createCreditCheckoutSession('org1', 'credits-2000', 'pix'),
    ).rejects.toMatchObject({
      status: 400,
      message:
        'O Pix não está disponível no momento. Para utilizá-lo, sua conta precisa estar aprovada.',
    });
    expect(prisma.creditPurchase.update).toHaveBeenCalledWith({
      where: { id: 'purchase-pix-rejected' },
      data: { status: 'FAILED' },
    });
  });

  it('returns the Asaas payer validation error instead of marking the package as uncertain', async () => {
    prisma.organization.findFirst.mockResolvedValue({ id: 'org1', deletedAt: null });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    creditPurchases.beginAsaasPackage.mockResolvedValue({
      created: true,
      purchase: { id: 'purchase-invalid' },
    });
    asaasClient.createHostedPayment.mockRejectedValue(
      new BadRequestException('O CPF informado é inválido'),
    );

    await expect(
      service.createCreditCheckoutSession('org1', 'credits-2000', 'card'),
    ).rejects.toMatchObject({
      status: 400,
      message: 'O CPF informado é inválido',
    });
    expect(prisma.creditPurchase.update).toHaveBeenCalledWith({
      where: { id: 'purchase-invalid' },
      data: { status: 'FAILED' },
    });
  });

  it('creates a recurring hosted Asaas checkout for the monthly plan', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      name: 'Acme',
      plan: OrgPlan.FREE,
      paymentProvider: null,
      planStatus: PlanStatus.INACTIVE,
      deletedAt: null,
    });
    prisma.billingProfile.findUnique.mockResolvedValue({
      name: 'Acme Ltda',
      cpfCnpj: '11222333000181',
      phone: '11999999999',
      email: 'financeiro@acme.test',
      asaasCustomerId: 'cus_1',
    });
    monthlyAttempts.beginCard.mockResolvedValue({
      state: 'acquired',
      claim: { id: 'attempt-1', externalId: 'org:org1:monthly-card:1' },
    });
    asaasClient.createRecurringCheckout.mockResolvedValue({
      id: 'checkout-1',
      url: 'https://sandbox.asaas.com/checkoutSession/show/checkout-1',
    });

    await expect(
      service.createCheckoutSession('org1', 'ana@example.com', 'monthly', 'BRL', 'card'),
    ).resolves.toMatchObject({
      mode: 'redirect',
      provider: 'ASAAS',
      externalCheckoutId: 'checkout-1',
    });
    expect(asaasClient.createRecurringCheckout).toHaveBeenCalledWith({
      externalReference: 'org:org1:monthly-card:1',
      amountCentavos: 4999,
      customerId: 'cus_1',
      successUrl: expect.any(String),
      cancelUrl: expect.any(String),
    });
    expect(monthlyAttempts.markReady).toHaveBeenCalled();
  });

  it('creates a one-time Asaas PIX payment for 30 days of monthly access', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'billing.pixProvider' ? 'ASAAS' : readConfig(key),
    );
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      name: 'Acme',
      plan: OrgPlan.FREE,
      paymentProvider: null,
      planStatus: PlanStatus.INACTIVE,
      deletedAt: null,
    });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    monthlyAttempts.beginPix.mockResolvedValue({
      state: 'acquired',
      claim: { id: 'attempt-pix-1', externalId: 'org:org1:monthly-pix:1' },
    });
    asaasClient.createPixPayment.mockResolvedValue({ id: 'pay_pix_monthly_1' });
    asaasClient.getPixQrCode.mockResolvedValue({
      payload: 'monthly-pix-copy-paste',
      encodedImage: 'cG5n',
      expirationDate: '2026-08-29T23:59:59Z',
    });

    await expect(
      service.createCheckoutSession('org1', 'ana@example.com', 'monthly', 'BRL', 'pix'),
    ).resolves.toEqual({
      mode: 'pix',
      provider: 'ASAAS',
      brCode: 'monthly-pix-copy-paste',
      brCodeBase64: 'cG5n',
      externalPaymentId: 'pay_pix_monthly_1',
      amountCentavos: 4999,
      expiresAt: '2026-08-29T23:59:59Z',
    });
    expect(asaasClient.createPixPayment).toHaveBeenCalledWith({
      customerId: 'cus_1',
      amountCentavos: 4999,
      externalReference: 'org:org1:monthly-pix:1',
      description: 'Prospectly Ilimitado (30 dias)',
    });
    expect(monthlyAttempts.markPixReady).toHaveBeenCalledWith(
      'org1',
      { id: 'attempt-pix-1', externalId: 'org:org1:monthly-pix:1' },
      'pay_pix_monthly_1',
      'cus_1',
    );
    expect(abacateProvider.createCheckout).not.toHaveBeenCalled();
  });

  it('returns the Asaas monthly PIX rejection instead of locking the organization in review', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'billing.pixProvider' ? 'ASAAS' : readConfig(key),
    );
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      name: 'Acme',
      plan: OrgPlan.FREE,
      paymentProvider: null,
      planStatus: PlanStatus.INACTIVE,
      deletedAt: null,
    });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    monthlyAttempts.beginPix.mockResolvedValue({
      state: 'acquired',
      claim: { id: 'attempt-pix-rejected', externalId: 'org:org1:monthly-pix:rejected' },
    });
    asaasClient.createPixPayment.mockRejectedValue(
      new BadRequestException(
        'O Pix não está disponível no momento. Para utilizá-lo, sua conta precisa estar aprovada.',
      ),
    );

    await expect(
      service.createCheckoutSession('org1', 'ana@example.com', 'monthly', 'BRL', 'pix'),
    ).rejects.toMatchObject({
      status: 400,
      message:
        'O Pix não está disponível no momento. Para utilizá-lo, sua conta precisa estar aprovada.',
    });
    expect(monthlyAttempts.markFailed).toHaveBeenCalled();
    expect(monthlyAttempts.markReviewRequired).not.toHaveBeenCalled();
  });

  it('expires an overdue monthly period inside the checkout request before renewing by PIX', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'billing.pixProvider' ? 'ASAAS' : readConfig(key),
    );
    const expired = {
      id: 'org1',
      name: 'Acme',
      plan: OrgPlan.STARTER_MONTHLY,
      paymentProvider: PaymentProvider.ASAAS,
      planStatus: PlanStatus.ACTIVE,
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
      deletedAt: null,
    };
    prisma.organization.findFirst.mockResolvedValueOnce(expired).mockResolvedValueOnce({
      ...expired,
      plan: OrgPlan.FREE,
      planStatus: PlanStatus.CANCELED,
    });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    monthlyAttempts.beginPix.mockResolvedValue({
      state: 'ready',
      paymentId: 'pay_pix_monthly_2',
    });
    asaasClient.getPixQrCode.mockResolvedValue({
      payload: 'monthly-pix-copy-paste',
      encodedImage: 'cG5n',
    });

    await expect(
      service.createCheckoutSession('org1', 'ana@example.com', 'monthly', 'BRL', 'pix'),
    ).resolves.toMatchObject({
      mode: 'pix',
      provider: 'ASAAS',
      externalPaymentId: 'pay_pix_monthly_2',
    });
    expect(activation.syncMonthlyStatus).toHaveBeenCalledWith({
      organizationId: 'org1',
      status: PlanStatus.CANCELED,
    });
  });

  it('blocks every Asaas checkout while any organization checkout needs review', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      name: 'Acme',
      plan: OrgPlan.FREE,
      paymentProvider: null,
      planStatus: PlanStatus.INACTIVE,
      deletedAt: null,
    });
    prisma.creditPurchase.findFirst.mockResolvedValue({ id: 'purchase-review' });

    await expect(
      service.createCheckoutSession('org1', 'ana@example.com', 'monthly', 'BRL', 'pix'),
    ).rejects.toMatchObject({ status: 503 });
    expect(abacateProvider.createCheckout).not.toHaveBeenCalled();
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

  it('cancels an Asaas card subscription and syncs local entitlement', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.STARTER_MONTHLY,
      paymentProvider: PaymentProvider.ASAAS,
      asaasSubscriptionId: 'sub_asaas_card',
      deletedAt: null,
    });
    asaasClient.cancelSubscription.mockResolvedValue(undefined);

    await expect(service.cancelSubscription('org1')).resolves.toEqual({ canceled: true });
    expect(asaasClient.cancelSubscription).toHaveBeenCalledWith('sub_asaas_card');
    expect(activation.syncMonthlyStatus).toHaveBeenCalledWith({
      organizationId: 'org1',
      status: PlanStatus.CANCELED,
      provider: PaymentProvider.ASAAS,
      asaasSubscriptionId: null,
    });
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });
});

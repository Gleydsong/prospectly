import {
  BillingCheckoutAttemptStatus,
  BillingPaymentMethod,
  PaymentProvider,
  Prisma,
} from '@prisma/client';

import { MonthlyCheckoutAttemptService } from './monthly-checkout-attempt.service';

describe('MonthlyCheckoutAttemptService', () => {
  const prisma = {
    monthlyCheckoutAttempt: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const service = new MonthlyCheckoutAttemptService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('creates the single card attempt with a stable external id', async () => {
    prisma.monthlyCheckoutAttempt.create.mockImplementation(async ({ data }) => ({
      id: 'attempt_1',
      ...data,
      status: BillingCheckoutAttemptStatus.PROCESSING,
      externalCheckoutId: null,
      externalCustomerId: null,
      checkoutUrl: null,
      attempts: 1,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    prisma.monthlyCheckoutAttempt.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.beginCard('org1');

    expect(result).toEqual(
      expect.objectContaining({
        state: 'acquired',
        claim: expect.objectContaining({ id: 'attempt_1' }),
      }),
    );
    expect(prisma.monthlyCheckoutAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org1',
        provider: PaymentProvider.ASAAS,
        paymentMethod: BillingPaymentMethod.CARD,
        externalId: expect.stringContaining('org:org1:monthly-card:'),
      }),
    });
  });

  it('creates a durable Asaas PIX attempt before external payment creation', async () => {
    prisma.monthlyCheckoutAttempt.create.mockImplementation(async ({ data }) => ({
      id: 'attempt_pix_1',
      ...data,
      status: BillingCheckoutAttemptStatus.PROCESSING,
      externalCheckoutId: null,
      externalCustomerId: null,
      checkoutUrl: null,
      attempts: 1,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await expect(service.beginPix('org1')).resolves.toEqual(
      expect.objectContaining({
        state: 'acquired',
        claim: expect.objectContaining({ id: 'attempt_pix_1' }),
      }),
    );
    expect(prisma.monthlyCheckoutAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org1',
        provider: PaymentProvider.ASAAS,
        paymentMethod: BillingPaymentMethod.PIX,
        externalId: expect.stringContaining('org:org1:monthly-pix:'),
      }),
    });
  });

  it('reuses the persisted Asaas monthly PIX payment', async () => {
    prisma.monthlyCheckoutAttempt.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6' }),
    );
    prisma.monthlyCheckoutAttempt.findFirst.mockResolvedValue({
      id: 'attempt_pix_1',
      organizationId: 'org1',
      provider: PaymentProvider.ASAAS,
      paymentMethod: BillingPaymentMethod.PIX,
      status: BillingCheckoutAttemptStatus.READY,
      externalId: 'org:org1:monthly-pix:1',
      externalCheckoutId: 'pay_pix_1',
      externalCustomerId: 'cus_1',
      checkoutUrl: null,
      attempts: 1,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(Date.now() - 31 * 60 * 1000),
    });

    await expect(service.beginPix('org1')).resolves.toEqual({
      state: 'ready',
      paymentId: 'pay_pix_1',
    });
  });

  it('marks a monthly PIX payment ready without storing its QR image', async () => {
    prisma.monthlyCheckoutAttempt.updateMany.mockResolvedValue({ count: 1 });

    await service.markPixReady(
      'org1',
      { id: 'attempt_pix_1', externalId: 'org:org1:monthly-pix:1' },
      'pay_pix_1',
      'cus_1',
    );

    expect(prisma.monthlyCheckoutAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'attempt_pix_1',
        organizationId: 'org1',
        status: BillingCheckoutAttemptStatus.PROCESSING,
      },
      data: {
        status: BillingCheckoutAttemptStatus.READY,
        externalCheckoutId: 'pay_pix_1',
        externalCustomerId: 'cus_1',
        lastError: null,
      },
    });
  });

  it('reuses a recent ready checkout without another provider call', async () => {
    prisma.monthlyCheckoutAttempt.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6' }),
    );
    prisma.monthlyCheckoutAttempt.findFirst.mockResolvedValue({
      id: 'attempt_1',
      organizationId: 'org1',
      provider: PaymentProvider.ASAAS,
      paymentMethod: BillingPaymentMethod.CARD,
      status: BillingCheckoutAttemptStatus.READY,
      externalId: 'external_1',
      externalCheckoutId: 'bill_1',
      externalCustomerId: 'cust_1',
      checkoutUrl: 'https://sandbox.asaas.com/c/bill_1',
      attempts: 1,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.beginCard('org1')).resolves.toEqual({
      state: 'ready',
      checkout: {
        mode: 'redirect',
        provider: 'ASAAS',
        url: 'https://sandbox.asaas.com/c/bill_1',
        externalCheckoutId: 'bill_1',
        externalCustomerId: 'cust_1',
      },
    });
    expect(prisma.monthlyCheckoutAttempt.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a second request while the first lease is active', async () => {
    prisma.monthlyCheckoutAttempt.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6' }),
    );
    prisma.monthlyCheckoutAttempt.findFirst.mockResolvedValue({
      id: 'attempt_1',
      status: BillingCheckoutAttemptStatus.PROCESSING,
      updatedAt: new Date(),
    });

    await expect(service.beginCard('org1')).rejects.toMatchObject({ status: 409 });
    expect(prisma.monthlyCheckoutAttempt.updateMany).not.toHaveBeenCalled();
  });

  it('resolves an attempt without overwriting its financial identifiers', async () => {
    prisma.monthlyCheckoutAttempt.updateMany.mockResolvedValue({ count: 1 });

    await service.markResolved('external_1', 'cus_1');

    expect(prisma.monthlyCheckoutAttempt.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ externalId: 'external_1' }),
      data: {
        status: BillingCheckoutAttemptStatus.RESOLVED,
        externalCustomerId: 'cus_1',
        lastError: null,
      },
    });
  });
});

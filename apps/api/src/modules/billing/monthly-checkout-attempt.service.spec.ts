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
      checkoutUrl: 'https://app.abacatepay.com/pay/bill_1',
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
        url: 'https://app.abacatepay.com/pay/bill_1',
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

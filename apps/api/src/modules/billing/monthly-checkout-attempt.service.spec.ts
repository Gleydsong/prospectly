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
      findUnique: jest.fn(),
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
        claim: expect.objectContaining({ recoverProviderState: false }),
      }),
    );
    expect(prisma.monthlyCheckoutAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org1',
        provider: PaymentProvider.ABACATE,
        paymentMethod: BillingPaymentMethod.CARD,
        externalId: expect.stringContaining('org:org1:monthly-card:'),
      }),
    });
  });

  it('reuses a recent ready checkout without another provider call', async () => {
    prisma.monthlyCheckoutAttempt.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6' }),
    );
    prisma.monthlyCheckoutAttempt.findUnique.mockResolvedValue({
      id: 'attempt_1',
      organizationId: 'org1',
      provider: PaymentProvider.ABACATE,
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
        provider: 'ABACATE',
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
    prisma.monthlyCheckoutAttempt.findUnique.mockResolvedValue({
      id: 'attempt_1',
      status: BillingCheckoutAttemptStatus.PROCESSING,
      updatedAt: new Date(),
    });

    await expect(service.beginCard('org1')).rejects.toMatchObject({ status: 409 });
    expect(prisma.monthlyCheckoutAttempt.updateMany).not.toHaveBeenCalled();
  });

  it('allows only one retrier to reclaim a failed attempt', async () => {
    prisma.monthlyCheckoutAttempt.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6' }),
    );
    prisma.monthlyCheckoutAttempt.findUnique.mockResolvedValue({
      id: 'attempt_1',
      status: BillingCheckoutAttemptStatus.FAILED,
      externalId: 'external_1',
      updatedAt: new Date(),
    });
    prisma.monthlyCheckoutAttempt.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(service.beginCard('org1')).resolves.toEqual({
      state: 'acquired',
      claim: {
        id: 'attempt_1',
        externalId: 'external_1',
        recoverProviderState: true,
      },
    });

    prisma.monthlyCheckoutAttempt.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.beginCard('org1')).rejects.toMatchObject({ status: 409 });
  });
});

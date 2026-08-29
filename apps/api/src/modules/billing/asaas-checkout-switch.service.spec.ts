import { BadRequestException } from '@nestjs/common';
import {
  BillingCheckoutAttemptStatus,
  BillingPaymentMethod,
  CreditPurchaseStatus,
  PaymentProvider,
} from '@prisma/client';

import { AsaasCheckoutSwitchService } from './asaas-checkout-switch.service';
import { AsaasRequestError } from './infrastructure/asaas.client';

describe('AsaasCheckoutSwitchService', () => {
  const prisma = {
    creditPurchase: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    monthlyCheckoutAttempt: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const asaasClient = {
    getPayment: jest.fn(),
    deletePayment: jest.fn(),
    cancelCheckout: jest.fn(),
    findPayment: jest.fn(),
  };
  const creditPurchases = { completeById: jest.fn() };
  const monthlyAttempts = { markResolved: jest.fn() };
  const activation = { activateMonthly: jest.fn() };
  const config = { get: jest.fn((key: string) => (key === 'frontendUrl' ? 'https://app.test' : undefined)) };

  const service = new AsaasCheckoutSwitchService(
    prisma as never,
    config as never,
    asaasClient as never,
    creditPurchases as never,
    monthlyAttempts as never,
    activation as never,
  );

  const pendingPix = {
    id: 'purchase-pix',
    organizationId: 'org1',
    offer: 'credits-2000',
    paymentMethod: BillingPaymentMethod.PIX,
    status: CreditPurchaseStatus.PENDING,
    externalPaymentId: 'pay_pix_1',
    provider: PaymentProvider.ASAAS,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.creditPurchase.findFirst.mockResolvedValue(null);
    prisma.monthlyCheckoutAttempt.findFirst.mockResolvedValue(null);
    prisma.creditPurchase.updateMany.mockResolvedValue({ count: 1 });
    prisma.monthlyCheckoutAttempt.updateMany.mockResolvedValue({ count: 1 });
    asaasClient.getPayment.mockReset();
    asaasClient.deletePayment.mockReset();
    asaasClient.cancelCheckout.mockReset();
    asaasClient.findPayment.mockReset();
    asaasClient.deletePayment.mockResolvedValue(undefined);
    asaasClient.cancelCheckout.mockResolvedValue(undefined);
    asaasClient.findPayment.mockResolvedValue(null);
  });

  it('leaves a matching pending PIX package in place', async () => {
    prisma.creditPurchase.findFirst.mockResolvedValue(pendingPix);

    await expect(
      service.prepare({ organizationId: 'org1', product: 'credits-2000', paymentMethod: 'pix' }),
    ).resolves.toEqual({ outcome: 'continue' });
    expect(asaasClient.deletePayment).not.toHaveBeenCalled();
    expect(prisma.creditPurchase.updateMany).not.toHaveBeenCalled();
  });

  it('deletes an unpaid PIX package before starting card on the same offer', async () => {
    prisma.creditPurchase.findFirst.mockResolvedValue(pendingPix);
    asaasClient.getPayment.mockResolvedValue({ id: 'pay_pix_1', status: 'PENDING' });

    await expect(
      service.prepare({ organizationId: 'org1', product: 'credits-2000', paymentMethod: 'card' }),
    ).resolves.toEqual({ outcome: 'continue' });
    expect(asaasClient.deletePayment).toHaveBeenCalledWith('pay_pix_1');
    expect(prisma.creditPurchase.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'purchase-pix',
        organizationId: 'org1',
        status: CreditPurchaseStatus.PENDING,
      },
      data: { status: CreditPurchaseStatus.FAILED },
    });
  });

  it('deletes a pending 2000 PIX when the payer starts 5000 card', async () => {
    prisma.creditPurchase.findFirst.mockResolvedValue(pendingPix);
    asaasClient.getPayment.mockResolvedValue({ id: 'pay_pix_1', status: 'PENDING' });

    await expect(
      service.prepare({ organizationId: 'org1', product: 'credits-5000', paymentMethod: 'card' }),
    ).resolves.toEqual({ outcome: 'continue' });
    expect(asaasClient.deletePayment).toHaveBeenCalledWith('pay_pix_1');
  });

  it('completes a PIX that was already received instead of opening card', async () => {
    prisma.creditPurchase.findFirst.mockResolvedValue(pendingPix);
    asaasClient.getPayment.mockResolvedValue({ id: 'pay_pix_1', status: 'RECEIVED' });

    await expect(
      service.prepare({ organizationId: 'org1', product: 'credits-2000', paymentMethod: 'card' }),
    ).resolves.toEqual({
      outcome: 'alreadyPaid',
      result: {
        mode: 'redirect',
        provider: 'ASAAS',
        url: 'https://app.test/billing/success',
      },
    });
    expect(creditPurchases.completeById).toHaveBeenCalledWith('purchase-pix', 'pay_pix_1');
    expect(asaasClient.deletePayment).not.toHaveBeenCalled();
    expect(prisma.creditPurchase.updateMany).not.toHaveBeenCalled();
  });

  it('completes the PIX when delete is rejected because it was just received', async () => {
    prisma.creditPurchase.findFirst.mockResolvedValue(pendingPix);
    asaasClient.getPayment
      .mockResolvedValueOnce({ id: 'pay_pix_1', status: 'PENDING' })
      .mockResolvedValueOnce({ id: 'pay_pix_1', status: 'RECEIVED' });
    asaasClient.deletePayment.mockRejectedValue(
      new BadRequestException('Não é possível remover uma cobrança recebida'),
    );

    await expect(
      service.prepare({ organizationId: 'org1', product: 'credits-2000', paymentMethod: 'card' }),
    ).resolves.toMatchObject({ outcome: 'alreadyPaid' });
    expect(creditPurchases.completeById).toHaveBeenCalledWith('purchase-pix', 'pay_pix_1');
  });

  it('locks the organization when delete is ambiguous', async () => {
    prisma.creditPurchase.findFirst.mockResolvedValue(pendingPix);
    asaasClient.getPayment.mockResolvedValue({ id: 'pay_pix_1', status: 'PENDING' });
    asaasClient.deletePayment.mockRejectedValue(new AsaasRequestError(true));

    await expect(
      service.prepare({ organizationId: 'org1', product: 'credits-2000', paymentMethod: 'card' }),
    ).rejects.toMatchObject({
      status: 503,
      message: 'Estamos confirmando seu checkout',
    });
    expect(prisma.creditPurchase.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'purchase-pix',
        organizationId: 'org1',
        status: CreditPurchaseStatus.PENDING,
      },
      data: { status: CreditPurchaseStatus.REVIEW_REQUIRED },
    });
  });

  it('cancels a ready monthly PIX before starting monthly card', async () => {
    prisma.monthlyCheckoutAttempt.findFirst.mockResolvedValue({
      id: 'attempt-pix',
      organizationId: 'org1',
      paymentMethod: BillingPaymentMethod.PIX,
      status: BillingCheckoutAttemptStatus.READY,
      externalId: 'org:org1:monthly-pix:1',
      externalCheckoutId: 'pay_month_1',
    });
    asaasClient.getPayment.mockResolvedValue({ id: 'pay_month_1', status: 'PENDING' });

    await expect(
      service.prepare({ organizationId: 'org1', product: 'monthly', paymentMethod: 'card' }),
    ).resolves.toEqual({ outcome: 'continue' });
    expect(asaasClient.deletePayment).toHaveBeenCalledWith('pay_month_1');
    expect(prisma.monthlyCheckoutAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'attempt-pix',
        organizationId: 'org1',
        status: {
          in: [BillingCheckoutAttemptStatus.PROCESSING, BillingCheckoutAttemptStatus.READY],
        },
      },
      data: {
        status: BillingCheckoutAttemptStatus.FAILED,
        lastError: 'Abandoned for a different checkout',
      },
    });
  });

  it('cancels a ready monthly card checkout before starting monthly PIX', async () => {
    prisma.monthlyCheckoutAttempt.findFirst.mockResolvedValue({
      id: 'attempt-card',
      organizationId: 'org1',
      paymentMethod: BillingPaymentMethod.CARD,
      status: BillingCheckoutAttemptStatus.READY,
      externalId: 'org:org1:monthly-card:1',
      externalCheckoutId: 'checkout-1',
    });
    asaasClient.findPayment.mockResolvedValue(null);

    await expect(
      service.prepare({ organizationId: 'org1', product: 'monthly', paymentMethod: 'pix' }),
    ).resolves.toEqual({ outcome: 'continue' });
    expect(asaasClient.cancelCheckout).toHaveBeenCalledWith('checkout-1');
  });

  it('abandons a pending credit PIX when the payer starts monthly card', async () => {
    prisma.creditPurchase.findFirst.mockResolvedValue(pendingPix);
    asaasClient.getPayment.mockResolvedValue({ id: 'pay_pix_1', status: 'PENDING' });

    await expect(
      service.prepare({ organizationId: 'org1', product: 'monthly', paymentMethod: 'card' }),
    ).resolves.toEqual({ outcome: 'continue' });
    expect(asaasClient.deletePayment).toHaveBeenCalledWith('pay_pix_1');
  });
});

import { AppmaxCheckoutKind, AppmaxCheckoutStatus, PaymentProvider } from '@prisma/client';

import { AppmaxPaymentService } from './appmax-payment.service';
import { AppmaxRequestError } from './infrastructure/appmax.client';

describe('AppmaxPaymentService', () => {
  const now = new Date('2026-08-24T00:00:00.000Z');
  const attempt = {
    id: 'attempt-1',
    organizationId: 'org-1',
    purchaseId: 'purchase-1',
    checkoutKey: 'f191b5ef-31b8-4c79-96c7-b233b522eb27',
    kind: AppmaxCheckoutKind.CREDITS,
    offer: 'credits-2000',
    amountCentavos: 1499,
    status: AppmaxCheckoutStatus.PAYMENT_PENDING,
    customerEmail: 'ana@example.com',
    externalCustomerId: '29',
    externalOrderId: '12345',
    externalSubscriptionId: null,
    providerStatus: null,
    attempts: 0,
    nextReconcileAt: now,
    lastReconciledAt: null,
    lastError: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const prisma = {
    appmaxCheckoutAttempt: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    billingWebhookEvent: { createMany: jest.fn() },
    creditPurchase: { findUnique: jest.fn(), updateMany: jest.fn() },
    organization: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
  const client = {
    getExternalId: jest.fn().mockReturnValue('external-installation'),
    getOrder: jest.fn(),
    getSubscription: jest.fn(),
    listSubscriptions: jest.fn(),
    createSubscription: jest.fn(),
  };
  const activation = { syncMonthlyStatus: jest.fn(), activateMonthly: jest.fn() };
  const creditPurchases = {
    completeById: jest.fn(),
    refundById: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'appmax.reconcileIntervalMs') return 30_000;
      if (key === 'appmax.monthlyProductId') return '55';
      return undefined;
    }),
  };
  const service = new AppmaxPaymentService(
    prisma as never,
    config as never,
    client as never,
    activation as never,
    creditPurchases as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.appmaxCheckoutAttempt.findUnique.mockResolvedValue(attempt);
    prisma.appmaxCheckoutAttempt.updateMany.mockResolvedValue({ count: 1 });
    prisma.appmaxCheckoutAttempt.update.mockResolvedValue(attempt);
  });

  it('treats an unsigned webhook only as a durable reconciliation signal', async () => {
    prisma.billingWebhookEvent.createMany.mockResolvedValue({ count: 1 });
    await expect(
      service.acceptWebhook(
        Buffer.from(JSON.stringify({ event_type: 'order_approved', data: { order_id: 12345 } })),
      ),
    ).resolves.toEqual({ received: true });

    expect(prisma.billingWebhookEvent.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ provider: PaymentProvider.APPMAX, type: 'order_approved' })],
      skipDuplicates: true,
    });
    expect(prisma.appmaxCheckoutAttempt.updateMany).toHaveBeenCalledWith({
      where: { externalOrderId: '12345' },
      data: expect.objectContaining({ status: AppmaxCheckoutStatus.RECONCILING }),
    });
    expect(client.getOrder).not.toHaveBeenCalled();
    expect(creditPurchases.completeById).not.toHaveBeenCalled();
  });

  it('does not persist untrusted webhook noise for an unknown Appmax resource', async () => {
    prisma.appmaxCheckoutAttempt.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.acceptWebhook(
        Buffer.from(JSON.stringify({ event: 'order_approved', data: { order_id: 99999 } })),
      ),
    ).resolves.toEqual({ received: true });

    expect(prisma.billingWebhookEvent.createMany).not.toHaveBeenCalled();
  });

  it('grants credits only after an authenticated order read confirms exact amount', async () => {
    client.getOrder.mockResolvedValue({
      id: 12345,
      status: 'aprovado',
      total: 1499,
      customer_id: 29,
    });

    await service.reconcileAttempt(attempt.id);

    expect(client.getOrder).toHaveBeenCalledWith('12345');
    expect(creditPurchases.completeById).toHaveBeenCalledWith('purchase-1', '12345');
    expect(prisma.appmaxCheckoutAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: attempt.id },
        data: expect.objectContaining({ status: AppmaxCheckoutStatus.COMPLETED }),
      }),
    );
  });

  it('refuses entitlement when the confirmed order amount differs', async () => {
    client.getOrder.mockResolvedValue({
      id: 12345,
      status: 'aprovado',
      total: 999,
      customer_id: 29,
    });

    await expect(service.reconcileAttempt(attempt.id)).rejects.toThrow(
      'Appmax order amount mismatch',
    );
    expect(creditPurchases.completeById).not.toHaveBeenCalled();
    expect(prisma.appmaxCheckoutAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: attempt.id },
        data: expect.objectContaining({ status: AppmaxCheckoutStatus.REVIEW_REQUIRED }),
      }),
    );
  });

  it('reverses completed credits only after a refund is confirmed by GET order', async () => {
    client.getOrder.mockResolvedValue({
      id: 12345,
      status: 'estornado',
      total: 1499,
      customer_id: 29,
    });
    prisma.creditPurchase.findUnique.mockResolvedValue({ status: 'COMPLETED' });

    await service.reconcileAttempt(attempt.id);

    expect(creditPurchases.refundById).toHaveBeenCalledWith('purchase-1');
    expect(activation.syncMonthlyStatus).not.toHaveBeenCalled();
  });

  it('reconciles instead of repeating an ambiguous subscription creation', async () => {
    const monthlyAttempt = {
      ...attempt,
      kind: AppmaxCheckoutKind.MONTHLY,
      offer: null,
      amountCentavos: 4999,
      purchaseId: null,
    };
    prisma.appmaxCheckoutAttempt.findUnique.mockResolvedValue(monthlyAttempt);
    client.getOrder.mockResolvedValue({
      id: 12345,
      status: 'aprovado',
      total: 4999,
      customer_id: 29,
    });
    client.listSubscriptions.mockResolvedValue({ subscriptions: [] });
    client.createSubscription.mockRejectedValue(
      new AppmaxRequestError('timeout after create', null, true),
    );

    await expect(service.reconcileAttempt(monthlyAttempt.id)).rejects.toThrow(
      'timeout after create',
    );
    expect(client.createSubscription).toHaveBeenCalledTimes(1);
    expect(prisma.appmaxCheckoutAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: monthlyAttempt.id },
        data: expect.objectContaining({ status: AppmaxCheckoutStatus.PAYMENT_PENDING }),
      }),
    );
  });

  it('does not activate a subscription whose confirmed charge has the wrong amount', async () => {
    const monthlyAttempt = {
      ...attempt,
      kind: AppmaxCheckoutKind.MONTHLY,
      offer: null,
      amountCentavos: 4999,
      purchaseId: null,
      externalSubscriptionId: 'subscription-1',
    };
    prisma.appmaxCheckoutAttempt.findUnique.mockResolvedValue(monthlyAttempt);
    prisma.organization.findUnique.mockResolvedValue({ appmaxCustomerId: '29' });
    client.getOrder.mockResolvedValue({
      id: 12345,
      status: 'aprovado',
      total: 4999,
      customer_id: 29,
    });
    client.getSubscription.mockResolvedValue({
      id: 'subscription-1',
      status: 'active',
      customer_id: 29,
      charges: [{ order_id: 12345, status: 'approved', value: 999 }],
    });

    await expect(service.reconcileAttempt(monthlyAttempt.id)).rejects.toThrow(
      'Appmax subscription charge amount mismatch',
    );
    expect(activation.syncMonthlyStatus).not.toHaveBeenCalled();
  });
});

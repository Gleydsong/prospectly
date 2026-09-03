import { CreditPurchaseStatus, PaymentProvider } from '@prisma/client';
import { CreditPurchaseService } from './credit-purchase.service';

describe('CreditPurchaseService', () => {
  it('credits the organization exactly once when payment is confirmed', async () => {
    const purchase = {
      id: 'purchase_1',
      organizationId: 'org_1',
      offer: 'credits-2000',
      credits: 2000,
      status: CreditPurchaseStatus.PENDING,
      provider: PaymentProvider.ABACATE,
      paymentMethod: 'PIX',
    };
    const tx = {
      creditPurchase: {
        findUnique: jest.fn().mockResolvedValueOnce(purchase),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      organization: { update: jest.fn().mockResolvedValue({ creditBalance: 2000 }) },
      creditLedgerEntry: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      creditPurchase: { findUnique: jest.fn().mockResolvedValue(purchase) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
    };
    const service = new CreditPurchaseService(prisma as never);

    await service.completeFromWebhook({ id: 'pix_1', metadata: { purchaseId: 'purchase_1' } });

    expect(tx.creditPurchase.updateMany).toHaveBeenCalledWith({
      where: { id: 'purchase_1', status: CreditPurchaseStatus.PENDING },
      data: expect.objectContaining({
        status: CreditPurchaseStatus.COMPLETED,
        externalPaymentId: 'pix_1',
      }),
    });
    expect(tx.organization.update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: { creditBalance: { increment: 2000 } },
      select: { creditBalance: true },
    });
    expect(tx.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: 'PURCHASE',
        delta: 2000,
        balanceAfter: 2000,
        idempotencyKey: 'purchase:purchase_1',
      }),
    });
    expect(PaymentProvider.ABACATE).toBeDefined();
  });

  it('does not complete a purchase already marked failed after abandonment', async () => {
    const prisma = {
      creditPurchase: {
        findUnique: jest.fn().mockResolvedValue({ status: CreditPurchaseStatus.FAILED }),
      },
      $transaction: jest.fn(),
    };
    const service = new CreditPurchaseService(prisma as never);
    await service.completeById('purchase_abandoned', 'pay_pix_1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not add balance for an already completed purchase', async () => {
    const prisma = {
      creditPurchase: {
        findUnique: jest.fn().mockResolvedValue({ status: CreditPurchaseStatus.COMPLETED }),
      },
      $transaction: jest.fn(),
    };
    const service = new CreditPurchaseService(prisma as never);
    await service.completeFromWebhook({ metadata: { purchaseId: 'purchase_1' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('resolves a review-required purchase after authoritative confirmation', async () => {
    const purchase = {
      id: 'purchase_review',
      organizationId: 'org_1',
      credits: 2000,
      status: CreditPurchaseStatus.REVIEW_REQUIRED,
      provider: PaymentProvider.ASAAS,
      paymentMethod: 'CARD',
    };
    const tx = {
      creditPurchase: {
        findUnique: jest.fn().mockResolvedValue(purchase),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      organization: { update: jest.fn().mockResolvedValue({ creditBalance: 2000 }) },
      creditLedgerEntry: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      creditPurchase: { findUnique: jest.fn().mockResolvedValue(purchase) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
    };
    const service = new CreditPurchaseService(prisma as never);

    await service.completeById('purchase_review', 'pay_1');

    expect(tx.creditPurchase.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'purchase_review', status: CreditPurchaseStatus.REVIEW_REQUIRED },
      }),
    );
    expect(tx.organization.update).toHaveBeenCalled();
  });

  it('skips credit increment when a concurrent handler already claimed the purchase', async () => {
    const purchase = {
      id: 'purchase_1',
      organizationId: 'org_1',
      offer: 'credits-2000',
      credits: 2000,
      status: CreditPurchaseStatus.PENDING,
    };
    const tx = {
      creditPurchase: {
        findUnique: jest.fn().mockResolvedValue(purchase),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      organization: { update: jest.fn() },
    };
    const prisma = {
      creditPurchase: { findUnique: jest.fn().mockResolvedValue(purchase) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
    };
    const service = new CreditPurchaseService(prisma as never);

    await service.completeFromWebhook({ id: 'pix_1', metadata: { purchaseId: 'purchase_1' } });

    expect(tx.organization.update).not.toHaveBeenCalled();
  });

  it('records the full reversal and allows a negative balance after consumed credits', async () => {
    const purchase = {
      id: 'purchase_1',
      organizationId: 'org_1',
      credits: 2000,
      status: CreditPurchaseStatus.COMPLETED,
    };
    const tx = {
      creditPurchase: {
        findUnique: jest.fn().mockResolvedValue(purchase),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      organization: {
        update: jest.fn().mockResolvedValue({ creditBalance: -1950 }),
      },
      creditLedgerEntry: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      creditPurchase: { findUnique: jest.fn().mockResolvedValue(purchase) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
    };
    const service = new CreditPurchaseService(prisma as never);
    await service.refundFromWebhook({ id: 'bill_1', metadata: { purchaseId: 'purchase_1' } });
    expect(tx.creditPurchase.updateMany).toHaveBeenCalledWith({
      where: { id: 'purchase_1', status: CreditPurchaseStatus.COMPLETED },
      data: expect.objectContaining({ status: CreditPurchaseStatus.REFUNDED }),
    });
    expect(tx.organization.update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: { creditBalance: { decrement: 2000 } },
      select: { creditBalance: true },
    });
    expect(tx.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org_1',
        purchaseId: 'purchase_1',
        reason: 'PURCHASE_REVERSAL',
        delta: -2000,
        balanceAfter: -1950,
        idempotencyKey: 'purchase-reversal:purchase_1',
      }),
    });
  });

  it('does not debit twice when a concurrent refund already claimed the purchase', async () => {
    const purchase = {
      id: 'purchase_1',
      organizationId: 'org_1',
      credits: 2000,
      status: CreditPurchaseStatus.COMPLETED,
    };
    const tx = {
      creditPurchase: {
        findUnique: jest.fn().mockResolvedValue(purchase),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      organization: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    const prisma = {
      creditPurchase: { findUnique: jest.fn().mockResolvedValue(purchase) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
    };
    const service = new CreditPurchaseService(prisma as never);
    await service.refundFromWebhook({ id: 'bill_1', metadata: { purchaseId: 'purchase_1' } });
    expect(tx.organization.findUnique).not.toHaveBeenCalled();
    expect(tx.organization.update).not.toHaveBeenCalled();
  });

  it('does not leave a completed purchase when the ledger insert fails', async () => {
    const purchase = {
      id: 'purchase_1',
      organizationId: 'org_1',
      offer: 'credits-2000',
      credits: 2000,
      status: CreditPurchaseStatus.PENDING,
      provider: PaymentProvider.ASAAS,
      paymentMethod: 'PIX',
    };
    const tx = {
      creditPurchase: {
        findUnique: jest.fn().mockResolvedValue(purchase),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      organization: { update: jest.fn().mockResolvedValue({ creditBalance: 2000 }) },
      creditLedgerEntry: { create: jest.fn().mockRejectedValue(new Error('ledger insert failed')) },
    };
    const prisma = {
      creditPurchase: { findUnique: jest.fn().mockResolvedValue(purchase) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
    };
    const service = new CreditPurchaseService(prisma as never);

    await expect(
      service.completeFromWebhook({ id: 'pix_1', metadata: { purchaseId: 'purchase_1' } }),
    ).rejects.toThrow('ledger insert failed');
  });
});

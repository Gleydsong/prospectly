import { CreditPurchaseStatus, PaymentProvider } from '@prisma/client';
import { CreditPurchaseService } from './credit-purchase.service';

describe('CreditPurchaseService', () => {
  it('credits the organization exactly once when payment is confirmed', async () => {
    const purchase = {
      id: 'purchase_1', organizationId: 'org_1', offer: 'credits-2000', credits: 2000,
      status: CreditPurchaseStatus.PENDING,
    };
    const tx = {
      creditPurchase: {
        findUnique: jest.fn().mockResolvedValueOnce(purchase),
        update: jest.fn().mockResolvedValue({}),
      },
      organization: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      creditPurchase: { findUnique: jest.fn().mockResolvedValue(purchase) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
    };
    const service = new CreditPurchaseService(prisma as never);

    await service.completeFromWebhook({ id: 'pix_1', metadata: { purchaseId: 'purchase_1' } });

    expect(tx.creditPurchase.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: CreditPurchaseStatus.COMPLETED }),
    }));
    expect(tx.organization.update).toHaveBeenCalledWith({
      where: { id: 'org_1' }, data: { creditBalance: { increment: 2000 } },
    });
    expect(PaymentProvider.ABACATE).toBeDefined();
  });

  it('does not add balance for an already completed purchase', async () => {
    const prisma = {
      creditPurchase: { findUnique: jest.fn().mockResolvedValue({ status: CreditPurchaseStatus.COMPLETED }) },
      $transaction: jest.fn(),
    };
    const service = new CreditPurchaseService(prisma as never);
    await service.completeFromWebhook({ metadata: { purchaseId: 'purchase_1' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fulfills credits by externalId when webhook omits metadata (Abacate v2)', async () => {
    const purchase = {
      id: 'purchase_2',
      organizationId: 'org_1',
      offer: 'credits-2000',
      credits: 2000,
      status: CreditPurchaseStatus.PENDING,
      externalId: 'org:org_1:credits:ext-2',
    };
    const tx = {
      creditPurchase: {
        findUnique: jest.fn().mockResolvedValueOnce(purchase),
        update: jest.fn().mockResolvedValue({}),
      },
      organization: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      creditPurchase: {
        findUnique: jest.fn(async (args: { where: Record<string, string> }) => {
          if (args.where.externalId === 'org:org_1:credits:ext-2') return purchase;
          return null;
        }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
    };
    const service = new CreditPurchaseService(prisma as never);

    await service.completeFromWebhook({
      id: 'char_credits_1',
      externalId: 'org:org_1:credits:ext-2',
    });

    expect(tx.organization.update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: { creditBalance: { increment: 2000 } },
    });
  });

  it('still credits when local purchase was marked FAILED after Abacate created the PIX', async () => {
    const purchase = {
      id: 'purchase_3',
      organizationId: 'org_1',
      offer: 'credits-5000',
      credits: 5000,
      status: CreditPurchaseStatus.FAILED,
    };
    const tx = {
      creditPurchase: {
        findUnique: jest.fn().mockResolvedValueOnce(purchase),
        update: jest.fn().mockResolvedValue({}),
      },
      organization: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      creditPurchase: { findUnique: jest.fn().mockResolvedValue(purchase) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
    };
    const service = new CreditPurchaseService(prisma as never);

    await service.completeFromWebhook({ id: 'pix_3', metadata: { purchaseId: 'purchase_3' } });

    expect(tx.creditPurchase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: CreditPurchaseStatus.COMPLETED }),
      }),
    );
    expect(tx.organization.update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: { creditBalance: { increment: 5000 } },
    });
  });
});

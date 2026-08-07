import { Injectable, Logger } from '@nestjs/common';
import { CreditPurchaseStatus, PaymentProvider } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CREDIT_PACKAGES } from './credit-purchase.constants';
import type { CreditOffer } from './domain/payment-provider';

@Injectable()
export class CreditPurchaseService {
  private readonly logger = new Logger(CreditPurchaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createPending(input: {
    organizationId: string;
    offer: CreditOffer;
    externalId: string;
    provider?: PaymentProvider;
  }) {
    const pack = CREDIT_PACKAGES[input.offer];
    return this.prisma.creditPurchase.create({
      data: {
        organizationId: input.organizationId,
        offer: input.offer,
        credits: pack.credits,
        amountCentavos: pack.amountCentavos,
        currency: 'BRL',
        provider: input.provider ?? PaymentProvider.ABACATE,
        externalId: input.externalId,
      },
    });
  }

  async attachPayment(purchaseId: string, externalPaymentId: string): Promise<void> {
    await this.prisma.creditPurchase.update({
      where: { id: purchaseId },
      data: { externalPaymentId },
    });
  }

  async completeFromWebhook(data: Record<string, unknown>): Promise<void> {
    const metadata = this.readMetadata(data);
    const paymentId = typeof data.id === 'string' ? data.id : undefined;
    const purchase = metadata.purchaseId
      ? await this.prisma.creditPurchase.findUnique({ where: { id: metadata.purchaseId } })
      : paymentId
        ? await this.prisma.creditPurchase.findUnique({ where: { externalPaymentId: paymentId } })
        : null;
    if (!purchase) {
      this.logger.warn('Credit payment completed without a matching purchase');
      return;
    }
    if (purchase.status !== CreditPurchaseStatus.PENDING) return;

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.creditPurchase.findUnique({ where: { id: purchase.id } });
      if (!current || current.status !== CreditPurchaseStatus.PENDING) return;

      await tx.creditPurchase.update({
        where: { id: current.id },
        data: {
          status: CreditPurchaseStatus.COMPLETED,
          completedAt: new Date(),
          ...(paymentId ? { externalPaymentId: paymentId } : {}),
        },
      });
      await tx.organization.update({
        where: { id: current.organizationId },
        data: { creditBalance: { increment: current.credits } },
      });
    });
  }

  async refundFromWebhook(data: Record<string, unknown>): Promise<void> {
    const metadata = this.readMetadata(data);
    const paymentId = typeof data.id === 'string' ? data.id : undefined;
    const purchase = metadata.purchaseId
      ? await this.prisma.creditPurchase.findUnique({ where: { id: metadata.purchaseId } })
      : paymentId
        ? await this.prisma.creditPurchase.findUnique({ where: { externalPaymentId: paymentId } })
        : null;
    if (!purchase || purchase.status === CreditPurchaseStatus.REFUNDED) return;

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.creditPurchase.findUnique({ where: { id: purchase.id } });
      if (!current || current.status === CreditPurchaseStatus.REFUNDED) return;
      if (current.status === CreditPurchaseStatus.COMPLETED) {
        const organization = await tx.organization.findUnique({
          where: { id: current.organizationId },
          select: { creditBalance: true },
        });
        const debit = Math.min(current.credits, organization?.creditBalance ?? 0);
        if (debit > 0) {
          await tx.organization.update({
            where: { id: current.organizationId },
            data: { creditBalance: { decrement: debit } },
          });
        }
      }
      await tx.creditPurchase.update({
        where: { id: current.id },
        data: { status: CreditPurchaseStatus.REFUNDED, refundedAt: new Date() },
      });
    });
  }

  private readMetadata(data: Record<string, unknown>): Record<string, string> {
    const raw = data.metadata;
    if (!raw || typeof raw !== 'object') return {};
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  }
}

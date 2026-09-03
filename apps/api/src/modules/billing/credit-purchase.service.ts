import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingPaymentMethod,
  CreditPurchaseStatus,
  PaymentProvider,
  Prisma,
  Role,
} from '@prisma/client';

import { MailService } from '../../common/mail/mail.service';
import { buildCreditsPurchasedEmail } from '../../common/mail/templates/credits-purchased-email';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CREDIT_PACKAGES } from './credit-purchase.constants';
import type { CreditOffer, PaymentMethod } from './domain/payment-provider';

type CompletedCreditPurchase = {
  id: string;
  organizationId: string;
  credits: number;
  amountCentavos: number;
  currency: string;
  completedAt: Date;
  balanceAfter: number;
};

@Injectable()
export class CreditPurchaseService {
  private readonly logger = new Logger(CreditPurchaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async createPending(input: {
    organizationId: string;
    offer: CreditOffer;
    externalId: string;
    provider?: PaymentProvider;
    paymentMethod?: PaymentMethod;
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
        paymentMethod:
          input.paymentMethod === 'card' ? BillingPaymentMethod.CARD : BillingPaymentMethod.PIX,
        externalId: input.externalId,
      },
    });
  }

  async beginAsaasPackage(input: {
    organizationId: string;
    offer: CreditOffer;
    externalId: string;
    paymentMethod: PaymentMethod;
  }) {
    const active = await this.findActiveAsaasPackage(input.organizationId);
    if (active) return { purchase: active, created: false };
    try {
      const purchase = await this.createPending({
        ...input,
        provider: PaymentProvider.ASAAS,
      });
      return { purchase, created: true };
    } catch (error) {
      if (!this.isUniqueConstraintViolation(error)) throw error;
      const concurrent = await this.findActiveAsaasPackage(input.organizationId);
      if (!concurrent) throw error;
      return { purchase: concurrent, created: false };
    }
  }

  async attachPayment(
    purchaseId: string,
    externalPaymentId: string,
    checkoutUrl?: string,
  ): Promise<void> {
    await this.prisma.creditPurchase.update({
      where: { id: purchaseId },
      data: { externalPaymentId, ...(checkoutUrl ? { checkoutUrl } : {}) },
    });
  }

  private findActiveAsaasPackage(organizationId: string) {
    return this.prisma.creditPurchase.findFirst({
      where: {
        organizationId,
        provider: PaymentProvider.ASAAS,
        status: { in: [CreditPurchaseStatus.PENDING, CreditPurchaseStatus.REVIEW_REQUIRED] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMatching(data: Record<string, unknown>) {
    const metadata = this.readMetadata(data);
    const paymentId = typeof data.id === 'string' ? data.id : undefined;
    const externalId = typeof data.externalId === 'string' ? data.externalId : undefined;

    if (metadata.purchaseId) {
      const byId = await this.prisma.creditPurchase.findUnique({
        where: { id: metadata.purchaseId },
      });
      if (byId) return byId;
    }
    if (paymentId) {
      const byPayment = await this.prisma.creditPurchase.findUnique({
        where: { externalPaymentId: paymentId },
      });
      if (byPayment) return byPayment;
    }
    if (externalId) {
      const byExternal = await this.prisma.creditPurchase.findUnique({ where: { externalId } });
      if (byExternal) return byExternal;
    }
    return null;
  }

  async completeFromWebhook(data: Record<string, unknown>): Promise<void> {
    const purchase = await this.findMatching(data);
    const paymentId = typeof data.id === 'string' ? data.id : undefined;
    if (!purchase) {
      this.logger.warn('Credit payment completed without a matching purchase');
      return;
    }
    if (
      purchase.status !== CreditPurchaseStatus.PENDING &&
      purchase.status !== CreditPurchaseStatus.REVIEW_REQUIRED
    )
      return;
    await this.completePurchase(purchase.id, paymentId);
  }

  async completeById(purchaseId: string, externalPaymentId: string): Promise<void> {
    const purchase = await this.prisma.creditPurchase.findUnique({ where: { id: purchaseId } });
    if (
      !purchase ||
      (purchase.status !== CreditPurchaseStatus.PENDING &&
        purchase.status !== CreditPurchaseStatus.REVIEW_REQUIRED)
    )
      return;
    await this.completePurchase(purchase.id, externalPaymentId);
  }

  async refundFromWebhook(data: Record<string, unknown>): Promise<void> {
    const purchase = await this.findMatching(data);
    if (!purchase || purchase.status === CreditPurchaseStatus.REFUNDED) return;

    await this.refundPurchase(purchase.id);
  }

  async refundById(purchaseId: string): Promise<void> {
    await this.refundPurchase(purchaseId);
  }

  private async refundPurchase(purchaseId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.creditPurchase.findUnique({ where: { id: purchaseId } });
      if (!current || current.status === CreditPurchaseStatus.REFUNDED) return;

      const claimed = await tx.creditPurchase.updateMany({
        where: { id: current.id, status: current.status },
        data: { status: CreditPurchaseStatus.REFUNDED, refundedAt: new Date() },
      });
      if (claimed.count !== 1) return;

      if (current.status === CreditPurchaseStatus.COMPLETED) {
        const organization = await tx.organization.update({
          where: { id: current.organizationId },
          data: { creditBalance: { decrement: current.credits } },
          select: { creditBalance: true },
        });
        await tx.creditLedgerEntry.create({
          data: {
            organizationId: current.organizationId,
            purchaseId: current.id,
            reason: 'PURCHASE_REVERSAL',
            delta: -current.credits,
            balanceAfter: organization.creditBalance,
            idempotencyKey: `purchase-reversal:${current.id}`,
            metadata: { cause: 'PAYMENT_REVERSED' },
          },
        });
      }
    });
  }

  private async completePurchase(purchaseId: string, externalPaymentId?: string): Promise<void> {
    const completed = await this.prisma.$transaction(async (tx) => {
      const current = await tx.creditPurchase.findUnique({ where: { id: purchaseId } });
      if (
        !current ||
        (current.status !== CreditPurchaseStatus.PENDING &&
          current.status !== CreditPurchaseStatus.REVIEW_REQUIRED)
      )
        return null;
      const claimed = await tx.creditPurchase.updateMany({
        where: { id: current.id, status: current.status },
        data: {
          status: CreditPurchaseStatus.COMPLETED,
          completedAt: new Date(),
          ...(externalPaymentId ? { externalPaymentId } : {}),
        },
      });
      if (claimed.count !== 1) return null;
      const organization = await tx.organization.update({
        where: { id: current.organizationId },
        data: { creditBalance: { increment: current.credits } },
        select: { creditBalance: true },
      });
      await tx.creditLedgerEntry.create({
        data: {
          organizationId: current.organizationId,
          purchaseId: current.id,
          reason: 'PURCHASE',
          delta: current.credits,
          balanceAfter: organization.creditBalance,
          idempotencyKey: `purchase:${current.id}`,
          metadata: { provider: current.provider, paymentMethod: current.paymentMethod },
        },
      });
      return {
        id: current.id,
        organizationId: current.organizationId,
        credits: current.credits,
        amountCentavos: current.amountCentavos,
        currency: current.currency,
        completedAt: new Date(),
        balanceAfter: organization.creditBalance,
      } satisfies CompletedCreditPurchase;
    });

    if (completed) {
      await this.notifyCreditsPurchased(completed);
    }
  }

  private async notifyCreditsPurchased(purchase: CompletedCreditPurchase): Promise<void> {
    try {
      const recipients = await this.prisma.organizationMember.findMany({
        where: {
          organizationId: purchase.organizationId,
          role: { in: [Role.OWNER, Role.ADMIN] },
        },
        select: {
          user: {
            select: { email: true, name: true, locale: true, anonymizedAt: true },
          },
        },
      });
      const appUrl = (this.config.get<string>('frontendUrl') ?? 'http://localhost:5173').replace(
        /\/$/,
        '',
      );

      for (const member of recipients) {
        const user = member.user;
        if (!user?.email || user.anonymizedAt) continue;
        const content = buildCreditsPurchasedEmail({
          locale: user.locale === 'en' ? 'en' : 'pt',
          fullName: user.name,
          credits: purchase.credits,
          amountCentavos: purchase.amountCentavos,
          currency: purchase.currency,
          purchasedAt: purchase.completedAt,
          balanceAfter: purchase.balanceAfter,
          appUrl,
        });
        await this.mail.send({
          to: user.email,
          subject: content.subject,
          text: content.text,
          html: content.html,
          template: content.template,
        });
      }

      this.logger.log(
        {
          template: 'credits-purchased',
          purchaseId: purchase.id,
          organizationId: purchase.organizationId,
          outcome: 'notified',
        },
        'credit purchase email dispatched',
      );
    } catch (err) {
      this.logger.error(
        {
          template: 'credits-purchased',
          purchaseId: purchase.id,
          organizationId: purchase.organizationId,
          outcome: 'failed',
          reason: err instanceof Error ? err.message : String(err),
        },
        'credit purchase email failed',
      );
    }
  }

  private readMetadata(data: Record<string, unknown>): Record<string, string> {
    const raw = data.metadata;
    if (!raw || typeof raw !== 'object') return {};
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}

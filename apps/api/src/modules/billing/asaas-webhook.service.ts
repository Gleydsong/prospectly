import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingWebhookEventStatus, PaymentProvider, PlanStatus, Prisma } from '@prisma/client';
import crypto from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingActivationService } from './billing-activation.service';
import { CreditPurchaseService } from './credit-purchase.service';
import { AsaasClient, type AsaasPayment } from './infrastructure/asaas.client';
import {
  MONTHLY_CHECKOUT_PROCESSING_LEASE_MS,
  MonthlyCheckoutAttemptService,
} from './monthly-checkout-attempt.service';

type AsaasEnvelope = {
  id: string;
  event: string;
  payment: { id: string };
};

class AsaasStatePendingError extends Error {}

@Injectable()
export class AsaasWebhookService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AsaasWebhookService.name);
  private timer?: NodeJS.Timeout;
  private lastReconciliationAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly client: AsaasClient,
    private readonly purchases: CreditPurchaseService,
    private readonly activation: BillingActivationService,
    private readonly monthlyAttempts: MonthlyCheckoutAttemptService,
  ) {}

  onModuleInit(): void {
    if (!this.isEnabled()) return;
    this.timer = setInterval(() => void this.processPending(), 5_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async ingest(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: true }> {
    this.authenticate(headers['asaas-access-token']);
    const payload = this.parseEnvelope(rawBody);
    try {
      await this.prisma.billingWebhookEvent.create({
        data: {
          provider: PaymentProvider.ASAAS,
          eventId: payload.id,
          type: payload.event,
          payload: payload as unknown as Prisma.InputJsonValue,
          status: BillingWebhookEventStatus.PENDING,
          attempts: 0,
        },
      });
    } catch (error) {
      if (!this.isUniqueConstraintViolation(error)) throw error;
    }
    return { received: true };
  }

  async processPending(): Promise<void> {
    if (!this.isEnabled()) return;
    const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
    const reviewBefore = new Date(Date.now() - 60 * 60 * 1000);
    const events = await this.prisma.billingWebhookEvent.findMany({
      where: {
        provider: PaymentProvider.ASAAS,
        OR: [
          {
            status: { in: [BillingWebhookEventStatus.PENDING, BillingWebhookEventStatus.FAILED] },
            attempts: { lt: 10 },
          },
          {
            status: BillingWebhookEventStatus.PROCESSING,
            attempts: { lt: 10 },
            updatedAt: { lt: staleBefore },
          },
          {
            status: BillingWebhookEventStatus.REVIEW_REQUIRED,
            updatedAt: { lt: reviewBefore },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    for (const event of events) {
      await this.processEvent(event.eventId).catch(() => undefined);
    }
    if (Date.now() - this.lastReconciliationAt >= 60_000) {
      this.lastReconciliationAt = Date.now();
      await this.reconcilePayments().catch((error) =>
        this.logger.warn(`Asaas reconciliation failed: ${this.sanitizeError(error)}`),
      );
    }
  }

  async processEvent(eventId: string): Promise<void> {
    if (!this.isEnabled()) return;
    const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
    const reviewBefore = new Date(Date.now() - 60 * 60 * 1000);
    const claimed = await this.prisma.billingWebhookEvent.updateMany({
      where: {
        provider: PaymentProvider.ASAAS,
        eventId,
        OR: [
          {
            status: { in: [BillingWebhookEventStatus.PENDING, BillingWebhookEventStatus.FAILED] },
            attempts: { lt: 10 },
          },
          {
            status: BillingWebhookEventStatus.PROCESSING,
            attempts: { lt: 10 },
            updatedAt: { lt: staleBefore },
          },
          {
            status: BillingWebhookEventStatus.REVIEW_REQUIRED,
            updatedAt: { lt: reviewBefore },
          },
        ],
      },
      data: {
        status: BillingWebhookEventStatus.PROCESSING,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    if (claimed.count !== 1) return;
    const event = await this.prisma.billingWebhookEvent.findUnique({
      where: { provider_eventId: { provider: PaymentProvider.ASAAS, eventId } },
    });
    if (!event) return;
    try {
      const envelope = this.parseStoredEnvelope(event.payload);
      const payment = await this.client.getPayment(envelope.payment.id);
      await this.applyPayment(event.type, payment);
      await this.prisma.billingWebhookEvent.updateMany({
        where: { provider: PaymentProvider.ASAAS, eventId },
        data: {
          status: BillingWebhookEventStatus.PROCESSED,
          processedAt: new Date(),
          failedAt: null,
          lastError: null,
        },
      });
    } catch (error) {
      const needsReview = error instanceof AsaasStatePendingError;
      await this.prisma.billingWebhookEvent.updateMany({
        where: { provider: PaymentProvider.ASAAS, eventId },
        data: {
          status: needsReview
            ? BillingWebhookEventStatus.REVIEW_REQUIRED
            : BillingWebhookEventStatus.FAILED,
          failedAt: needsReview ? null : new Date(),
          lastError: this.sanitizeError(error),
        },
      });
      throw error;
    }
  }

  private async applyPayment(type: string, payment: AsaasPayment): Promise<void> {
    if (!payment.externalReference) throw new Error('Asaas payment without external reference');
    const purchase = await this.prisma.creditPurchase.findUnique({
      where: { externalId: payment.externalReference },
    });
    if (purchase) {
      const profile = await this.prisma.billingProfile.findUnique({
        where: { organizationId: purchase.organizationId },
      });
      this.assertPaymentMatches(payment, {
        customerId: profile?.asaasCustomerId,
        amountCentavos: purchase.amountCentavos,
        externalReference: purchase.externalId,
      });
      this.assertSupportedReversal(type);
      this.assertChargebackTerminal(type, payment);
      if (type === 'PAYMENT_CONFIRMED' && payment.status === 'CONFIRMED') {
        await this.purchases.completeById(purchase.id, payment.id);
      } else if (type === 'PAYMENT_REFUNDED' && payment.status === 'REFUNDED') {
        await this.purchases.refundById(purchase.id);
      } else if (type.startsWith('PAYMENT_CHARGEBACK') && this.isConfirmedChargeback(payment)) {
        await this.purchases.refundById(purchase.id);
      }
      return;
    }

    const attempt = await this.prisma.monthlyCheckoutAttempt.findUnique({
      where: { externalId: payment.externalReference },
    });
    if (!attempt) throw new Error('Asaas payment does not match a Prospectly checkout');
    const profile = await this.prisma.billingProfile.findUnique({
      where: { organizationId: attempt.organizationId },
    });
    if (attempt.product !== 'MONTHLY_ACCESS' || attempt.currency !== 'BRL') {
      throw new Error('Asaas payment has invalid Prospectly product metadata');
    }
    this.assertPaymentMatches(payment, {
      customerId: profile?.asaasCustomerId,
      amountCentavos: attempt.amountCentavos,
      externalReference: attempt.externalId,
      billingTypes: ['CREDIT_CARD'],
    });
    this.assertSupportedReversal(type);
    this.assertChargebackTerminal(type, payment);
    if (!payment.subscription) throw new Error('Asaas recurring payment without subscription');
    if (type === 'PAYMENT_CONFIRMED' && payment.status === 'CONFIRMED') {
      await this.activation.activateMonthly({
        organizationId: attempt.organizationId,
        currency: 'BRL',
        provider: PaymentProvider.ASAAS,
        asaasSubscriptionId: payment.subscription,
        currentPeriodEnd: this.periodEnd(payment.dueDate),
      });
      await this.monthlyAttempts.markResolved(attempt.externalId, payment.customer);
    } else if (type === 'PAYMENT_REFUNDED' && payment.status === 'REFUNDED') {
      await this.activation.syncMonthlyStatus({
        organizationId: attempt.organizationId,
        status: PlanStatus.CANCELED,
        provider: PaymentProvider.ASAAS,
        asaasSubscriptionId: payment.subscription,
        currentPeriodEnd: new Date(),
      });
      await this.monthlyAttempts.markResolved(attempt.externalId, payment.customer);
    } else if (type.startsWith('PAYMENT_CHARGEBACK') && this.isConfirmedChargeback(payment)) {
      await this.activation.syncMonthlyStatus({
        organizationId: attempt.organizationId,
        status: PlanStatus.CANCELED,
        provider: PaymentProvider.ASAAS,
        asaasSubscriptionId: payment.subscription,
        currentPeriodEnd: new Date(),
      });
      await this.monthlyAttempts.markResolved(attempt.externalId, payment.customer);
    }
  }

  private async reconcilePayments(): Promise<void> {
    const purchases = await this.prisma.creditPurchase.findMany({
      where: {
        provider: PaymentProvider.ASAAS,
        status: { in: ['PENDING', 'REVIEW_REQUIRED'] },
      },
      orderBy: [{ lastReconciledAt: { sort: 'asc', nulls: 'first' } }, { updatedAt: 'asc' }],
      take: 20,
    });
    for (const purchase of purchases) {
      try {
        const payment = purchase.externalPaymentId
          ? await this.client.getPayment(purchase.externalPaymentId)
          : await this.client.findPayment({ externalReference: purchase.externalId });
        if (payment) {
          await this.applyReconciledPayment(payment);
          if (this.isTerminalWithoutBenefit(payment)) {
            await this.prisma.creditPurchase.updateMany({
              where: { id: purchase.id, status: { in: ['PENDING', 'REVIEW_REQUIRED'] } },
              data: { status: 'FAILED' },
            });
          }
        } else if (
          purchase.status === 'PENDING' &&
          purchase.updatedAt.getTime() < Date.now() - 2 * 60 * 1000
        ) {
          await this.prisma.creditPurchase.updateMany({
            where: { id: purchase.id, status: 'PENDING' },
            data: { status: 'FAILED' },
          });
        }
      } catch (error) {
        this.logger.warn(
          `Asaas purchase reconciliation failed for ${purchase.id}: ${this.sanitizeError(error)}`,
        );
      } finally {
        await this.prisma.creditPurchase.updateMany({
          where: { id: purchase.id },
          data: { lastReconciledAt: new Date() },
        });
      }
    }

    const staleProcessingBefore = new Date(Date.now() - MONTHLY_CHECKOUT_PROCESSING_LEASE_MS);
    const attempts = await this.prisma.monthlyCheckoutAttempt.findMany({
      where: {
        provider: PaymentProvider.ASAAS,
        OR: [
          { status: { in: ['READY', 'REVIEW_REQUIRED'] } },
          { status: 'PROCESSING', updatedAt: { lt: staleProcessingBefore } },
        ],
      },
      orderBy: [{ lastReconciledAt: { sort: 'asc', nulls: 'first' } }, { updatedAt: 'asc' }],
      take: 20,
    });
    for (const attempt of attempts) {
      try {
        if (attempt.status === 'PROCESSING') {
          await this.monthlyAttempts.markReviewRequired(
            attempt.organizationId,
            { id: attempt.id, externalId: attempt.externalId },
            new Error('Checkout response requires authoritative reconciliation'),
          );
        }
        const payment = await this.client.findPayment({
          externalReference: attempt.externalId,
          ...(attempt.externalCheckoutId ? { checkoutSession: attempt.externalCheckoutId } : {}),
        });
        if (payment) {
          await this.applyReconciledPayment(payment);
          if (this.isTerminalWithoutBenefit(payment)) {
            await this.monthlyAttempts.markPaymentFailed(
              attempt.externalId,
              `Asaas payment ${payment.status ?? 'deleted'}`,
            );
          }
        }
      } catch (error) {
        this.logger.warn(
          `Asaas monthly reconciliation failed for ${attempt.id}: ${this.sanitizeError(error)}`,
        );
      } finally {
        await this.prisma.monthlyCheckoutAttempt.updateMany({
          where: { id: attempt.id },
          data: { lastReconciledAt: new Date() },
        });
      }
    }
  }

  private async applyReconciledPayment(payment: AsaasPayment): Promise<void> {
    const eventType =
      payment.status === 'CONFIRMED'
        ? 'PAYMENT_CONFIRMED'
        : payment.status === 'REFUNDED'
          ? 'PAYMENT_REFUNDED'
          : this.isConfirmedChargeback(payment)
            ? 'PAYMENT_CHARGEBACK_REQUESTED'
            : null;
    if (eventType) await this.applyPayment(eventType, payment);
  }

  private assertSupportedReversal(type: string): void {
    if (type === 'PAYMENT_PARTIALLY_REFUNDED') {
      throw new Error('Partial Asaas refund requires support review');
    }
  }

  private assertChargebackTerminal(type: string, payment: AsaasPayment): void {
    if (type.startsWith('PAYMENT_CHARGEBACK') && !this.isConfirmedChargeback(payment)) {
      throw new AsaasStatePendingError('Asaas chargeback is not terminal');
    }
  }

  private isConfirmedChargeback(payment: AsaasPayment): boolean {
    return (
      payment.status === 'CHARGEBACK_REQUESTED' &&
      (payment.chargebackStatus === 'DONE' || payment.chargebackStatus === 'DISPUTE_LOST')
    );
  }

  private isTerminalWithoutBenefit(payment: AsaasPayment): boolean {
    return payment.deleted === true;
  }

  private assertPaymentMatches(
    payment: AsaasPayment,
    expected: {
      customerId?: string | null;
      amountCentavos: number;
      externalReference: string;
      billingTypes?: string[];
    },
  ): void {
    if (
      !expected.customerId ||
      payment.customer !== expected.customerId ||
      Math.round((payment.value ?? -1) * 100) !== expected.amountCentavos ||
      payment.externalReference !== expected.externalReference ||
      !(expected.billingTypes ?? ['CREDIT_CARD', 'DEBIT_CARD']).includes(payment.billingType ?? '')
    ) {
      throw new Error('Asaas payment does not match the Prospectly checkout');
    }
  }

  private authenticate(received: string | string[] | undefined): void {
    const expected = this.config.get<string>('asaas.webhookToken');
    const actual = Array.isArray(received) ? received[0] : received;
    if (!expected || !actual) throw new UnauthorizedException('Invalid Asaas webhook token');
    const left = Buffer.from(expected);
    const right = Buffer.from(actual);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
      throw new UnauthorizedException('Invalid Asaas webhook token');
    }
  }

  private isEnabled(): boolean {
    return this.config.get<boolean>('asaas.enabled') === true;
  }

  private parseEnvelope(rawBody: Buffer): AsaasEnvelope {
    try {
      return this.parseStoredEnvelope(JSON.parse(rawBody.toString('utf8')));
    } catch {
      throw new BadRequestException('Invalid Asaas webhook payload');
    }
  }

  private parseStoredEnvelope(value: unknown): AsaasEnvelope {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
    const record = value as Record<string, unknown>;
    const payment = record.payment;
    if (
      typeof record.id !== 'string' ||
      typeof record.event !== 'string' ||
      !payment ||
      typeof payment !== 'object' ||
      Array.isArray(payment) ||
      typeof (payment as Record<string, unknown>).id !== 'string'
    ) {
      throw new Error('invalid');
    }
    return value as AsaasEnvelope;
  }

  private periodEnd(dueDate?: string): Date {
    const start = dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : new Date();
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return end;
  }

  private sanitizeError(error: unknown): string {
    const message = error instanceof Error ? error.message : 'processing_failed';
    return message.replace(/Bearer\s+\S+/gi, '[redacted]').slice(0, 500);
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}

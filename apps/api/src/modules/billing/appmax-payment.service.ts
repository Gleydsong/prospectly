import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppmaxCheckoutKind,
  AppmaxCheckoutStatus,
  BillingWebhookEventStatus,
  PaymentProvider,
  PlanStatus,
  type AppmaxCheckoutAttempt,
} from '@prisma/client';
import { createHash } from 'node:crypto';

import { runWithBypass } from '../../common/prisma/tenant-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingActivationService } from './billing-activation.service';
import { MONTHLY_PLAN_AMOUNT_CENTAVOS } from './billing.constants';
import { CREDIT_PACKAGES } from './credit-purchase.constants';
import { CreditPurchaseService } from './credit-purchase.service';
import type { CreditOffer } from './domain/payment-provider';
import type { CreateAppmaxCardCheckoutDto } from './dto/create-appmax-card-checkout.dto';
import { AppmaxClient, AppmaxRequestError } from './infrastructure/appmax.client';

const APPROVED_ORDER_STATUSES = new Set(['APROVADO', 'INTEGRADO', 'APPROVED', 'INTEGRATED']);
const APPROVED_CHARGE_STATUSES = new Set([
  'APROVADO',
  'INTEGRADO',
  'APPROVED',
  'INTEGRATED',
  'PAID',
  'SUCCESS',
]);
const TERMINAL_FAILURE_STATUSES = new Set([
  'CANCELADO',
  'CANCELED',
  'RECUSADO',
  'RECUSADO_POR_RISCO',
  'REFUSED_BY_RISK',
  'ESTORNADO',
  'REFUNDED',
  'CHARGEBACK_PERDIDO',
]);

type CardCheckoutInput = CreateAppmaxCardCheckoutDto & {
  organizationId: string;
  authenticatedEmail: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function remoteId(value: string): string | number {
  return /^\d+$/.test(value) ? Number(value) : value;
}

function normalizedStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase().replace(/[ -]+/g, '_') : 'UNKNOWN';
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function dateValue(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

@Injectable()
export class AppmaxPaymentService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AppmaxPaymentService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly client: AppmaxClient,
    private readonly activation: BillingActivationService,
    private readonly creditPurchases: CreditPurchaseService,
  ) {}

  getBrowserConfig(): { externalId: string; scriptUrl: string } {
    this.assertCheckoutEnabled();
    return {
      externalId: this.client.getExternalId(),
      scriptUrl: 'https://scripts.appmax.com.br/appmax.min.js',
    };
  }

  getHealthCheck(): { external_id: string } {
    return { external_id: this.client.getExternalId() };
  }

  async createCardCheckout(input: CardCheckoutInput) {
    this.assertCheckoutEnabled();
    if (input.email.trim().toLowerCase() !== input.authenticatedEmail.trim().toLowerCase()) {
      throw new BadRequestException('Card checkout email must match the authenticated user');
    }
    if (input.purpose === 'credits' && !input.offer) {
      throw new BadRequestException('Credit offer is required');
    }
    if (input.purpose === 'monthly' && input.offer) {
      throw new BadRequestException('Credit offer is not allowed for monthly checkout');
    }

    const amountCentavos =
      input.purpose === 'monthly'
        ? MONTHLY_PLAN_AMOUNT_CENTAVOS
        : CREDIT_PACKAGES[input.offer as CreditOffer].amountCentavos;
    const existing = await this.prisma.appmaxCheckoutAttempt.findUnique({
      where: { checkoutKey: input.checkoutKey },
    });
    if (existing) return this.resumeExisting(existing, input.organizationId);

    let attempt: AppmaxCheckoutAttempt;
    try {
      attempt = await this.createAttempt(input, amountCentavos);
    } catch (error) {
      const raced = await this.prisma.appmaxCheckoutAttempt.findUnique({
        where: { checkoutKey: input.checkoutKey },
      });
      if (raced) return this.resumeExisting(raced, input.organizationId);
      throw error;
    }
    try {
      const customer = await this.client.createCustomer({
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        email: input.authenticatedEmail.trim().toLowerCase(),
        phone: input.phone,
        ip: input.ip,
        document_number: input.documentNumber,
      });
      const customerData = record(customer.customer ?? customer);
      const customerId = textId(customerData.id ?? customer.customer_id ?? customer.id);
      if (!customerId) throw new ServiceUnavailableException('Appmax customer response has no id');
      await this.prisma.appmaxCheckoutAttempt.update({
        where: { id: attempt.id },
        data: { externalCustomerId: customerId },
      });

      const product = this.productFor(input.purpose, input.offer);
      let order: Record<string, unknown>;
      try {
        order = await this.client.createOrder({
          customer_id: remoteId(customerId),
          products: [{ ...product, quantity: 1, unit_value: amountCentavos, type: 'digital' }],
          products_value: amountCentavos,
          discount_value: 0,
          shipping_value: 0,
        });
      } catch (error) {
        await this.failAttempt(
          attempt.id,
          error,
          error instanceof AppmaxRequestError && error.ambiguous,
        );
        throw error;
      }
      const orderData = record(order.order ?? order);
      const orderId = textId(orderData.id ?? order.order_id ?? order.id);
      if (!orderId) {
        await this.failAttempt(attempt.id, new Error('Appmax order response has no id'), true);
        throw new ServiceUnavailableException('Appmax order response has no id');
      }
      await this.prisma.appmaxCheckoutAttempt.update({
        where: { id: attempt.id },
        data: { externalOrderId: orderId, status: AppmaxCheckoutStatus.PROCESSING },
      });

      try {
        await this.client.payCreditCard({
          order_id: remoteId(orderId),
          customer_id: remoteId(customerId),
          payment_data: {
            credit_card: {
              token: input.cardToken,
              holder_document_number: input.documentNumber,
              holder_name: input.holderName.trim(),
              installments: 1,
              soft_descriptor: 'PROSPECTLY',
            },
          },
        });
      } catch (error) {
        if (!(error instanceof AppmaxRequestError) || !error.ambiguous) throw error;
        this.logger.warn(`Ambiguous Appmax card response for order ${orderId}; reconciling by GET`);
      }
      await this.prisma.appmaxCheckoutAttempt.update({
        where: { id: attempt.id },
        data: {
          status: AppmaxCheckoutStatus.PAYMENT_PENDING,
          nextReconcileAt: new Date(),
          lastError: null,
        },
      });
      await this.reconcileAttempt(attempt.id);
      const current = await this.prisma.appmaxCheckoutAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      });
      return this.toCheckoutResult(current);
    } catch (error) {
      const current = await this.prisma.appmaxCheckoutAttempt.findUnique({
        where: { id: attempt.id },
      });
      if (current?.status === AppmaxCheckoutStatus.PROCESSING) {
        const ambiguous = error instanceof AppmaxRequestError && error.ambiguous;
        await this.failAttempt(attempt.id, error, ambiguous && !current.externalOrderId);
      }
      throw error;
    }
  }

  private assertCheckoutEnabled(): void {
    if (this.config.get<boolean>('appmax.enabled') !== true) {
      throw new ServiceUnavailableException('Appmax card checkout is not enabled');
    }
  }

  async acceptWebhook(rawBody: Buffer): Promise<{ received: true }> {
    let payload: Record<string, unknown>;
    try {
      payload = record(JSON.parse(rawBody.toString('utf8')) as unknown);
    } catch {
      throw new BadRequestException('Invalid Appmax webhook JSON');
    }
    const eventValue = payload.event ?? payload.event_type;
    const event = typeof eventValue === 'string' ? eventValue : '';
    const data = record(payload.data);
    this.validateWebhookSource(payload);
    const orderId = textId(data.order_id ?? data.id);
    const subscriptionId = textId(data.subscription_id);
    if (!event || (!orderId && !subscriptionId)) {
      throw new BadRequestException('Appmax webhook missing event/resource id');
    }

    const where = orderId
      ? { externalOrderId: orderId }
      : { externalSubscriptionId: subscriptionId! };
    const scheduled = await this.prisma.appmaxCheckoutAttempt.updateMany({
      where,
      data: { status: AppmaxCheckoutStatus.RECONCILING, nextReconcileAt: new Date() },
    });
    if (scheduled.count === 0) return { received: true };

    const eventId = createHash('sha256').update(rawBody).digest('hex');
    await this.prisma.billingWebhookEvent.createMany({
      data: [
        {
          provider: PaymentProvider.APPMAX,
          eventId,
          type: event.slice(0, 120),
          status: BillingWebhookEventStatus.PROCESSED,
          processedAt: new Date(),
        },
      ],
      skipDuplicates: true,
    });
    return { received: true };
  }

  async cancelSubscription(organizationId: string, subscriptionId: string): Promise<void> {
    await this.client.cancelSubscription(subscriptionId);
    const remote = await this.client.getSubscription(subscriptionId);
    const status = normalizedStatus(record(remote.subscription ?? remote).status ?? remote.status);
    if (!['CANCELED', 'CANCELLED', 'CANCELADO'].includes(status)) {
      throw new ServiceUnavailableException('Appmax did not confirm subscription cancellation');
    }
    await this.activation.syncMonthlyStatus({ organizationId, status: PlanStatus.CANCELED });
  }

  onApplicationBootstrap(): void {
    const interval = this.config.get<number>('appmax.reconcileIntervalMs') ?? 30_000;
    void this.reconcileDue();
    this.timer = setInterval(() => void this.reconcileDue(), interval);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async reconcileDue(): Promise<void> {
    await runWithBypass(async () => {
      const attempts = await this.prisma.appmaxCheckoutAttempt.findMany({
        where: {
          status: { in: [AppmaxCheckoutStatus.PAYMENT_PENDING, AppmaxCheckoutStatus.RECONCILING] },
          OR: [{ nextReconcileAt: null }, { nextReconcileAt: { lte: new Date() } }],
        },
        orderBy: { updatedAt: 'asc' },
        take: 20,
      });
      for (const attempt of attempts) {
        try {
          await this.reconcileAttempt(attempt.id);
        } catch (error) {
          this.logger.warn(
            `Appmax reconciliation failed for ${attempt.id}: ${this.safeError(error)}`,
          );
        }
      }

      const staleSubscriptions = await this.prisma.organization.findMany({
        where: {
          paymentProvider: PaymentProvider.APPMAX,
          appmaxSubscriptionId: { not: null },
          OR: [
            { appmaxLastReconciledAt: null },
            { appmaxLastReconciledAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          ],
        },
        select: { id: true, appmaxSubscriptionId: true },
        take: 20,
      });
      for (const org of staleSubscriptions) {
        if (!org.appmaxSubscriptionId) continue;
        await this.syncSubscription(org.id, org.appmaxSubscriptionId).catch((error) => {
          this.logger.warn(
            `Appmax subscription reconciliation failed for ${org.id}: ${this.safeError(error)}`,
          );
        });
      }
    });
  }

  async reconcileAttempt(attemptId: string): Promise<void> {
    const attempt = await this.prisma.appmaxCheckoutAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt || !attempt.externalOrderId) return;
    const now = new Date();
    const claimed = await this.prisma.appmaxCheckoutAttempt.updateMany({
      where: { id: attempt.id, updatedAt: attempt.updatedAt },
      data: {
        status: AppmaxCheckoutStatus.RECONCILING,
        attempts: { increment: 1 },
        lastReconciledAt: now,
        nextReconcileAt: new Date(now.getTime() + this.backoffMs(attempt.attempts + 1)),
      },
    });
    if (claimed.count !== 1) return;

    try {
      const response = await this.client.getOrder(attempt.externalOrderId);
      const order = record(response.order ?? response);
      const status = normalizedStatus(order.status ?? response.status);
      this.validateOrder(attempt, order);
      if (APPROVED_ORDER_STATUSES.has(status)) {
        if (attempt.kind === AppmaxCheckoutKind.CREDITS) {
          if (!attempt.purchaseId) throw new Error('Appmax credit attempt has no purchase');
          await this.creditPurchases.completeById(attempt.purchaseId, attempt.externalOrderId);
          await this.completeAttempt(attempt.id, status);
          return;
        }
        await this.ensureMonthlySubscription(attempt, status);
        return;
      }
      if (TERMINAL_FAILURE_STATUSES.has(status)) {
        await this.prisma.appmaxCheckoutAttempt.update({
          where: { id: attempt.id },
          data: {
            status: AppmaxCheckoutStatus.FAILED,
            providerStatus: status,
            nextReconcileAt: null,
          },
        });
        if (attempt.purchaseId) {
          const purchase = await this.prisma.creditPurchase.findUnique({
            where: { id: attempt.purchaseId },
          });
          if (purchase?.status === 'COMPLETED') {
            await this.creditPurchases.refundById(attempt.purchaseId);
          } else {
            await this.prisma.creditPurchase.updateMany({
              where: { id: attempt.purchaseId, status: 'PENDING' },
              data: { status: 'FAILED' },
            });
          }
        } else if (attempt.kind === AppmaxCheckoutKind.MONTHLY) {
          await this.activation.syncMonthlyStatus({
            organizationId: attempt.organizationId,
            status: PlanStatus.CANCELED,
          });
        }
        return;
      }
      await this.prisma.appmaxCheckoutAttempt.update({
        where: { id: attempt.id },
        data: { status: AppmaxCheckoutStatus.PAYMENT_PENDING, providerStatus: status },
      });
    } catch (error) {
      const shouldReview = !(error instanceof AppmaxRequestError);
      await this.prisma.appmaxCheckoutAttempt.update({
        where: { id: attempt.id },
        data: {
          status: shouldReview
            ? AppmaxCheckoutStatus.REVIEW_REQUIRED
            : AppmaxCheckoutStatus.PAYMENT_PENDING,
          nextReconcileAt: shouldReview ? null : undefined,
          lastError: this.safeError(error),
        },
      });
      throw error;
    }
  }

  private async createAttempt(input: CardCheckoutInput, amountCentavos: number) {
    return this.prisma.$transaction(async (tx) => {
      let purchaseId: string | undefined;
      if (input.purpose === 'credits') {
        const pack = CREDIT_PACKAGES[input.offer as CreditOffer];
        const purchase = await tx.creditPurchase.create({
          data: {
            organizationId: input.organizationId,
            offer: input.offer!,
            credits: pack.credits,
            amountCentavos: pack.amountCentavos,
            currency: 'BRL',
            provider: PaymentProvider.APPMAX,
            paymentMethod: 'CARD',
            externalId: `appmax:${input.checkoutKey}`,
          },
        });
        purchaseId = purchase.id;
      }
      return tx.appmaxCheckoutAttempt.create({
        data: {
          organizationId: input.organizationId,
          purchaseId,
          checkoutKey: input.checkoutKey,
          kind:
            input.purpose === 'monthly' ? AppmaxCheckoutKind.MONTHLY : AppmaxCheckoutKind.CREDITS,
          offer: input.offer,
          amountCentavos,
          customerEmail: input.authenticatedEmail.trim().toLowerCase(),
        },
      });
    });
  }

  private async resumeExisting(attempt: AppmaxCheckoutAttempt, organizationId: string) {
    if (attempt.organizationId !== organizationId) {
      throw new ConflictException('Checkout key is already in use');
    }
    if (!attempt.externalOrderId || attempt.status === AppmaxCheckoutStatus.REVIEW_REQUIRED) {
      throw new ConflictException({
        code: 'APPMAX_REVIEW_REQUIRED',
        message: 'This checkout is under manual reconciliation; do not submit it again.',
      });
    }
    if (
      attempt.status !== AppmaxCheckoutStatus.COMPLETED &&
      attempt.status !== AppmaxCheckoutStatus.FAILED
    ) {
      await this.reconcileAttempt(attempt.id);
    }
    const current = await this.prisma.appmaxCheckoutAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
    return this.toCheckoutResult(current);
  }

  private productFor(purpose: 'monthly' | 'credits', offer?: CreditOffer) {
    if (purpose === 'monthly') {
      return { sku: 'prospectly-unlimited-monthly', name: 'Prospectly Ilimitado mensal' };
    }
    return offer === 'credits-2000'
      ? { sku: 'prospectly-credits-2000', name: 'Prospectly 2.000 créditos' }
      : { sku: 'prospectly-credits-5000', name: 'Prospectly 5.000 créditos' };
  }

  private validateOrder(attempt: AppmaxCheckoutAttempt, order: Record<string, unknown>): void {
    const total = numericValue(
      order.total ?? order.total_value ?? order.products_value ?? order.value,
    );
    if (total === null) throw new Error('Appmax order has no verifiable total');
    const totalCentavos = Number.isInteger(total) ? total : Math.round(total * 100);
    if (totalCentavos !== attempt.amountCentavos) {
      throw new Error(`Appmax order amount mismatch: expected ${attempt.amountCentavos}`);
    }
    const customer = record(order.customer);
    const customerId = textId(order.customer_id ?? customer.id);
    if (customerId && attempt.externalCustomerId && customerId !== attempt.externalCustomerId) {
      throw new Error('Appmax order customer mismatch');
    }
  }

  private async ensureMonthlySubscription(
    attempt: AppmaxCheckoutAttempt,
    orderStatus: string,
  ): Promise<void> {
    if (attempt.externalSubscriptionId) {
      await this.syncSubscription(attempt.organizationId, attempt.externalSubscriptionId);
      await this.completeAttempt(attempt.id, orderStatus);
      return;
    }

    const recovered = await this.findSubscriptionForOrder(
      attempt.customerEmail,
      attempt.externalOrderId!,
    );
    if (recovered) {
      await this.attachAndActivateSubscription(attempt, recovered, orderStatus);
      return;
    }

    if (attempt.providerStatus === 'SUBSCRIPTION_CREATING') {
      if (attempt.attempts < 4) {
        await this.prisma.appmaxCheckoutAttempt.update({
          where: { id: attempt.id },
          data: {
            status: AppmaxCheckoutStatus.PAYMENT_PENDING,
            nextReconcileAt: new Date(Date.now() + this.backoffMs(attempt.attempts + 1)),
            lastError: 'Waiting to recover subscription after an ambiguous create response',
          },
        });
        return;
      }
      await this.prisma.appmaxCheckoutAttempt.update({
        where: { id: attempt.id },
        data: {
          status: AppmaxCheckoutStatus.REVIEW_REQUIRED,
          nextReconcileAt: null,
          lastError: 'Subscription create response was lost and recovery found no safe match',
        },
      });
      return;
    }

    await this.prisma.appmaxCheckoutAttempt.update({
      where: { id: attempt.id },
      data: { providerStatus: 'SUBSCRIPTION_CREATING' },
    });
    const productId = this.config.get<string>('appmax.monthlyProductId')?.trim();
    if (!productId)
      throw new ServiceUnavailableException('APPMAX_MONTHLY_PRODUCT_ID is not configured');
    try {
      const response = await this.client.createSubscription({
        order_id: remoteId(attempt.externalOrderId!),
        interval: 'month',
        interval_count: 1,
        products: [{ product_id: remoteId(productId), quantity: 1 }],
        freight_value: 0,
        discount: 0,
      });
      const subscription = record(response.subscription ?? response);
      const subscriptionId = textId(subscription.id ?? response.subscription_id ?? response.id);
      if (!subscriptionId) throw new Error('Appmax subscription response has no id');
      await this.attachAndActivateSubscription(attempt, subscriptionId, orderStatus);
    } catch (error) {
      const ambiguous = error instanceof AppmaxRequestError && error.ambiguous;
      await this.prisma.appmaxCheckoutAttempt.update({
        where: { id: attempt.id },
        data: {
          status: ambiguous
            ? AppmaxCheckoutStatus.PAYMENT_PENDING
            : AppmaxCheckoutStatus.REVIEW_REQUIRED,
          nextReconcileAt: ambiguous
            ? new Date(Date.now() + this.backoffMs(attempt.attempts + 1))
            : null,
          lastError: this.safeError(error),
        },
      });
      throw error;
    }
  }

  private async findSubscriptionForOrder(email: string, orderId: string): Promise<string | null> {
    const response = await this.client.listSubscriptions(email);
    const candidates = this.findArray(response, ['subscriptions', 'items', 'data']);
    for (const candidate of candidates) {
      const row = record(candidate);
      const subscriptionId = textId(row.id ?? row.subscription_id);
      if (!subscriptionId) continue;
      const detailResponse = await this.client.getSubscription(subscriptionId);
      const detail = record(detailResponse.subscription ?? detailResponse);
      const charges = this.findArray(detail, ['charges']);
      if (charges.some((charge) => textId(record(charge).order_id) === orderId)) {
        return subscriptionId;
      }
    }
    return null;
  }

  private async attachAndActivateSubscription(
    attempt: AppmaxCheckoutAttempt,
    subscriptionId: string,
    orderStatus: string,
  ): Promise<void> {
    await this.prisma.appmaxCheckoutAttempt.update({
      where: { id: attempt.id },
      data: { externalSubscriptionId: subscriptionId },
    });
    await this.activation.activateMonthly({
      organizationId: attempt.organizationId,
      currency: 'BRL',
      provider: PaymentProvider.APPMAX,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    await this.prisma.organization.update({
      where: { id: attempt.organizationId },
      data: {
        appmaxCustomerId: attempt.externalCustomerId,
        appmaxSubscriptionId: subscriptionId,
        appmaxLastReconciledAt: new Date(),
      },
    });
    await this.completeAttempt(attempt.id, orderStatus);
  }

  private async syncSubscription(organizationId: string, subscriptionId: string): Promise<void> {
    const response = await this.client.getSubscription(subscriptionId);
    const subscription = record(response.subscription ?? response);
    const confirmedSubscriptionId = textId(subscription.id ?? response.subscription_id);
    if (confirmedSubscriptionId && confirmedSubscriptionId !== subscriptionId) {
      throw new Error('Appmax subscription id mismatch');
    }
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { appmaxCustomerId: true },
    });
    const customer = record(subscription.customer);
    const customerId = textId(subscription.customer_id ?? customer.id);
    if (
      customerId &&
      organization?.appmaxCustomerId &&
      customerId !== organization.appmaxCustomerId
    ) {
      throw new Error('Appmax subscription customer mismatch');
    }
    const successfulCharges = this.findArray(subscription, ['charges'])
      .map(record)
      .filter((charge) => APPROVED_CHARGE_STATUSES.has(normalizedStatus(charge.status)));
    for (const charge of successfulCharges) {
      const amount = numericValue(charge.value ?? charge.total ?? charge.amount);
      if (amount !== null) {
        const amountCentavos = Number.isInteger(amount) ? amount : Math.round(amount * 100);
        if (amountCentavos !== MONTHLY_PLAN_AMOUNT_CENTAVOS) {
          throw new Error('Appmax subscription charge amount mismatch');
        }
      }
    }
    const status = normalizedStatus(subscription.status ?? response.status);
    const nextChargeAt = dateValue(subscription.next_charge_at);
    const active = ['ACTIVE', 'ATIVO'].includes(status);
    const pastDue = ['DELAYED', 'ATRASADO', 'PAST_DUE'].includes(status);
    const canceled = ['CANCELED', 'CANCELLED', 'CANCELADO', 'INACTIVE', 'INATIVO'].includes(status);
    if (active || pastDue || canceled) {
      await this.activation.syncMonthlyStatus({
        organizationId,
        status: active ? PlanStatus.ACTIVE : pastDue ? PlanStatus.PAST_DUE : PlanStatus.CANCELED,
        currentPeriodEnd: nextChargeAt,
      });
    }
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { appmaxLastReconciledAt: new Date() },
    });
  }

  private async completeAttempt(id: string, providerStatus: string): Promise<void> {
    await this.prisma.appmaxCheckoutAttempt.update({
      where: { id },
      data: {
        status: AppmaxCheckoutStatus.COMPLETED,
        providerStatus,
        completedAt: new Date(),
        nextReconcileAt: null,
        lastError: null,
      },
    });
  }

  private async failAttempt(id: string, error: unknown, review: boolean): Promise<void> {
    const attempt = await this.prisma.appmaxCheckoutAttempt.findUnique({ where: { id } });
    await this.prisma.appmaxCheckoutAttempt.update({
      where: { id },
      data: {
        status: review ? AppmaxCheckoutStatus.REVIEW_REQUIRED : AppmaxCheckoutStatus.FAILED,
        nextReconcileAt: null,
        lastError: this.safeError(error),
      },
    });
    if (!review && attempt?.purchaseId) {
      await this.prisma.creditPurchase.updateMany({
        where: { id: attempt.purchaseId, status: 'PENDING' },
        data: { status: 'FAILED' },
      });
    }
  }

  private toCheckoutResult(attempt: AppmaxCheckoutAttempt) {
    if (!attempt.externalOrderId) {
      throw new ConflictException('Appmax checkout has no recoverable order');
    }
    return {
      mode: 'pending' as const,
      provider: 'APPMAX' as const,
      externalOrderId: attempt.externalOrderId,
      status: attempt.status,
    };
  }

  private findArray(source: Record<string, unknown>, keys: string[]): unknown[] {
    for (const key of keys) {
      if (Array.isArray(source[key])) return source[key] as unknown[];
    }
    return [];
  }

  private validateWebhookSource(payload: Record<string, unknown>): void {
    const expectedAppId = this.config.get<string>('appmax.appId')?.trim();
    const expectedSiteId = this.config.get<string>('appmax.siteId')?.trim();
    const appId = textId(payload.app_id);
    const siteId = textId(payload.site_id);
    if (
      (expectedAppId && appId !== expectedAppId) ||
      (expectedSiteId && siteId !== expectedSiteId)
    ) {
      throw new BadRequestException('Appmax webhook source does not match this installation');
    }
  }

  private backoffMs(attempts: number): number {
    return Math.min(15 * 60_000, 30_000 * 2 ** Math.min(attempts, 5));
  }

  private safeError(error: unknown): string {
    const message = error instanceof Error ? error.message : 'appmax_operation_failed';
    return message.replace(/Bearer\s+\S+/gi, '[redacted]').slice(0, 500);
  }
}

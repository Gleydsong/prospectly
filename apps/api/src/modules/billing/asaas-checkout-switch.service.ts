import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingCheckoutAttemptStatus,
  BillingPaymentMethod,
  CreditPurchaseStatus,
  PaymentProvider,
  type CreditPurchase,
  type MonthlyCheckoutAttempt,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingActivationService } from './billing-activation.service';
import { CreditPurchaseService } from './credit-purchase.service';
import { asaasPaymentGrantsBenefit } from './domain/asaas-payment-state';
import type { CheckoutResult, CreditOffer, PaymentMethod } from './domain/payment-provider';
import { AsaasClient, AsaasRequestError, type AsaasPayment } from './infrastructure/asaas.client';
import { MonthlyCheckoutAttemptService } from './monthly-checkout-attempt.service';

export type CheckoutProduct = CreditOffer | 'monthly';

export type CheckoutSwitchRequest = {
  organizationId: string;
  product: CheckoutProduct;
  paymentMethod: PaymentMethod;
};

export type CheckoutSwitchResult =
  | { outcome: 'continue' }
  | { outcome: 'alreadyPaid'; result: CheckoutResult };

@Injectable()
export class AsaasCheckoutSwitchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly asaasClient: AsaasClient,
    private readonly creditPurchases: CreditPurchaseService,
    private readonly monthlyAttempts: MonthlyCheckoutAttemptService,
    private readonly activation: BillingActivationService,
  ) {}

  async prepare(request: CheckoutSwitchRequest): Promise<CheckoutSwitchResult> {
    const wanted = toBillingMethod(request.paymentMethod);
    const [purchase, monthly] = await Promise.all([
      this.findActivePurchase(request.organizationId),
      this.findActiveMonthly(request.organizationId),
    ]);

    if (purchase && !this.matchesPurchase(purchase, request.product, wanted)) {
      const paid = await this.abandonPurchase(purchase);
      if (paid) return { outcome: 'alreadyPaid', result: this.successRedirect() };
    }
    if (monthly && !this.matchesMonthly(monthly, request.product, wanted)) {
      const paid = await this.abandonMonthly(monthly);
      if (paid) return { outcome: 'alreadyPaid', result: this.successRedirect() };
    }
    return { outcome: 'continue' };
  }

  private matchesPurchase(
    purchase: CreditPurchase,
    product: CheckoutProduct,
    method: BillingPaymentMethod,
  ): boolean {
    return (
      product !== 'monthly' &&
      purchase.offer === product &&
      purchase.paymentMethod === method &&
      purchase.status === CreditPurchaseStatus.PENDING
    );
  }

  private matchesMonthly(
    attempt: MonthlyCheckoutAttempt,
    product: CheckoutProduct,
    method: BillingPaymentMethod,
  ): boolean {
    return product === 'monthly' && attempt.paymentMethod === method;
  }

  private findActivePurchase(organizationId: string) {
    return this.prisma.creditPurchase.findFirst({
      where: {
        organizationId,
        provider: PaymentProvider.ASAAS,
        status: CreditPurchaseStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private findActiveMonthly(organizationId: string) {
    return this.prisma.monthlyCheckoutAttempt.findFirst({
      where: {
        organizationId,
        provider: PaymentProvider.ASAAS,
        status: {
          in: [BillingCheckoutAttemptStatus.PROCESSING, BillingCheckoutAttemptStatus.READY],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async abandonPurchase(purchase: CreditPurchase): Promise<boolean> {
    const isPix = purchase.paymentMethod === BillingPaymentMethod.PIX;
    // No provider charge yet — another request may still be creating it. Do not
    // mark FAILED or a concurrent attachPayment can leave a payable charge
    // tied to a row the webhook will refuse to fulfill.
    if (!purchase.externalPaymentId) {
      await this.markPurchaseReview(purchase);
      this.failUncertain(new Error('Checkout still being created on Asaas'));
    }
    try {
      const paid = await this.settleOrDeletePayment(purchase.externalPaymentId, isPix);
      if (paid) {
        await this.creditPurchases.completeById(purchase.id, paid.id);
        return true;
      }
    } catch (error) {
      await this.markPurchaseReview(purchase);
      this.failUncertain(error);
    }
    await this.prisma.creditPurchase.updateMany({
      where: {
        id: purchase.id,
        organizationId: purchase.organizationId,
        status: CreditPurchaseStatus.PENDING,
      },
      data: { status: CreditPurchaseStatus.FAILED },
    });
    return false;
  }

  private async abandonMonthly(attempt: MonthlyCheckoutAttempt): Promise<boolean> {
    const isPix = attempt.paymentMethod === BillingPaymentMethod.PIX;
    const externalId = attempt.externalCheckoutId;
    if (!externalId) {
      await this.markMonthlyReview(attempt, 'Checkout still being created on Asaas');
      this.failUncertain(new Error('Checkout still being created on Asaas'));
    }
    try {
      if (isPix) {
        const paid = await this.settleOrDeletePayment(externalId, true);
        if (paid) {
          await this.grantMonthlyPix(attempt, paid);
          return true;
        }
      } else {
        const paid = await this.settleOrCancelCheckout(externalId);
        if (paid) {
          await this.grantMonthlyCard(attempt, paid);
          return true;
        }
      }
    } catch (error) {
      await this.markMonthlyReview(attempt, 'Checkout response requires authoritative reconciliation');
      this.failUncertain(error);
    }
    await this.prisma.monthlyCheckoutAttempt.updateMany({
      where: {
        id: attempt.id,
        organizationId: attempt.organizationId,
        status: {
          in: [BillingCheckoutAttemptStatus.PROCESSING, BillingCheckoutAttemptStatus.READY],
        },
      },
      data: {
        status: BillingCheckoutAttemptStatus.FAILED,
        lastError: 'Abandoned for a different checkout',
      },
    });
    return false;
  }

  private async settleOrDeletePayment(
    paymentId: string,
    isPix: boolean,
  ): Promise<AsaasPayment | null> {
    const current = await this.readPayment(paymentId);
    if (!current || current.deleted === true) return null;
    if (asaasPaymentGrantsBenefit(current, isPix)) return current;
    try {
      await this.asaasClient.deletePayment(paymentId);
      return null;
    } catch (error) {
      return this.recoverAfterFailedCancel(paymentId, isPix, error);
    }
  }

  private async settleOrCancelCheckout(checkoutId: string): Promise<AsaasPayment | null> {
    const existing = await this.asaasClient.findPayment({ checkoutSession: checkoutId });
    if (existing && asaasPaymentGrantsBenefit(existing, false)) return existing;
    try {
      await this.asaasClient.cancelCheckout(checkoutId);
      return null;
    } catch (error) {
      const retried = await this.asaasClient.findPayment({ checkoutSession: checkoutId });
      if (retried && asaasPaymentGrantsBenefit(retried, false)) return retried;
      this.failUncertain(error);
    }
  }

  private async recoverAfterFailedCancel(
    paymentId: string,
    isPix: boolean,
    error: unknown,
  ): Promise<AsaasPayment | null> {
    if (error instanceof BadRequestException || error instanceof AsaasRequestError) {
      const retried = await this.readPayment(paymentId);
      if (!retried || retried.deleted === true) return null;
      if (asaasPaymentGrantsBenefit(retried, isPix)) return retried;
    }
    this.failUncertain(error);
  }

  private async readPayment(paymentId: string): Promise<AsaasPayment | null> {
    try {
      return await this.asaasClient.getPayment(paymentId);
    } catch (error) {
      if (error instanceof AsaasRequestError && error.httpStatus === 404) return null;
      this.failUncertain(error);
    }
  }

  private async grantMonthlyPix(attempt: MonthlyCheckoutAttempt, payment: AsaasPayment) {
    await this.activation.activateMonthly({
      organizationId: attempt.organizationId,
      currency: 'BRL',
      provider: PaymentProvider.ASAAS,
      asaasSubscriptionId: null,
      asaasPaymentId: payment.id,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    await this.monthlyAttempts.markResolved(attempt.externalId, payment.customer);
  }

  private async grantMonthlyCard(attempt: MonthlyCheckoutAttempt, payment: AsaasPayment) {
    if (!payment.subscription) {
      await this.markMonthlyReview(attempt, 'Asaas recurring payment without subscription');
      throw new ServiceUnavailableException('Estamos confirmando seu checkout');
    }
    await this.activation.activateMonthly({
      organizationId: attempt.organizationId,
      currency: 'BRL',
      provider: PaymentProvider.ASAAS,
      asaasSubscriptionId: payment.subscription,
      asaasPaymentId: null,
      currentPeriodEnd: payment.dueDate
        ? this.cardPeriodEnd(payment.dueDate)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    await this.monthlyAttempts.markResolved(attempt.externalId, payment.customer);
  }

  private async markPurchaseReview(purchase: CreditPurchase) {
    await this.prisma.creditPurchase.updateMany({
      where: {
        id: purchase.id,
        organizationId: purchase.organizationId,
        status: CreditPurchaseStatus.PENDING,
      },
      data: { status: CreditPurchaseStatus.REVIEW_REQUIRED },
    });
  }

  private async markMonthlyReview(attempt: MonthlyCheckoutAttempt, lastError: string) {
    await this.prisma.monthlyCheckoutAttempt.updateMany({
      where: {
        id: attempt.id,
        organizationId: attempt.organizationId,
        status: {
          in: [BillingCheckoutAttemptStatus.PROCESSING, BillingCheckoutAttemptStatus.READY],
        },
      },
      data: { status: BillingCheckoutAttemptStatus.REVIEW_REQUIRED, lastError },
    });
  }

  private cardPeriodEnd(dueDate: string): Date {
    const start = new Date(`${dueDate}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return end;
  }

  private successRedirect(): CheckoutResult {
    const frontendUrl = this.config.get<string>('frontendUrl') ?? 'http://localhost:5173';
    return {
      mode: 'redirect',
      provider: 'ASAAS',
      url: `${frontendUrl.replace(/\/$/, '')}/billing/success`,
    };
  }

  private failUncertain(error: unknown): never {
    if (
      error instanceof ServiceUnavailableException &&
      !(error instanceof AsaasRequestError) &&
      error.message === 'Estamos confirmando seu checkout'
    ) {
      throw error;
    }
    throw new ServiceUnavailableException('Estamos confirmando seu checkout');
  }
}

function toBillingMethod(method: PaymentMethod): BillingPaymentMethod {
  return method === 'card' ? BillingPaymentMethod.CARD : BillingPaymentMethod.PIX;
}

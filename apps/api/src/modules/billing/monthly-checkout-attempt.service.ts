import { ConflictException, Injectable } from '@nestjs/common';
import {
  BillingCheckoutAttemptStatus,
  BillingPaymentMethod,
  PaymentProvider,
  Prisma,
  type MonthlyCheckoutAttempt,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { MONTHLY_PLAN_AMOUNT_CENTAVOS } from './billing.constants';
import type { CheckoutResult } from './domain/payment-provider';

export const MONTHLY_CHECKOUT_PROCESSING_LEASE_MS = 2 * 60 * 1000;
const READY_RECHECK_MS = 30 * 60 * 1000;

export type MonthlyCheckoutClaim = {
  id: string;
  externalId: string;
};

export type MonthlyCheckoutBeginResult =
  { state: 'ready'; checkout: CheckoutResult } | { state: 'acquired'; claim: MonthlyCheckoutClaim };

export type MonthlyPixCheckoutBeginResult =
  { state: 'ready'; paymentId: string } | { state: 'acquired'; claim: MonthlyCheckoutClaim };

type InternalBeginResult =
  | { state: 'ready'; attempt: MonthlyCheckoutAttempt }
  | { state: 'acquired'; claim: MonthlyCheckoutClaim };

@Injectable()
export class MonthlyCheckoutAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  async beginCard(organizationId: string): Promise<MonthlyCheckoutBeginResult> {
    const begin = await this.begin(organizationId, BillingPaymentMethod.CARD);
    if (begin.state === 'ready') {
      return { state: 'ready', checkout: this.toCheckout(begin.attempt) };
    }
    return begin;
  }

  async beginPix(organizationId: string): Promise<MonthlyPixCheckoutBeginResult> {
    const begin = await this.begin(organizationId, BillingPaymentMethod.PIX);
    if (begin.state === 'ready') {
      if (!begin.attempt.externalCheckoutId) {
        throw new ConflictException('Monthly PIX checkout is not ready. Try again shortly.');
      }
      return { state: 'ready', paymentId: begin.attempt.externalCheckoutId };
    }
    return begin;
  }

  private async begin(
    organizationId: string,
    paymentMethod: BillingPaymentMethod,
  ): Promise<InternalBeginResult> {
    const { attempt, created } = await this.createOrFind(organizationId, paymentMethod);
    if (created) {
      return {
        state: 'acquired',
        claim: {
          id: attempt.id,
          externalId: attempt.externalId,
        },
      };
    }
    const now = Date.now();

    if (attempt.paymentMethod !== paymentMethod) {
      throw new ConflictException('Another Asaas checkout is already in progress.');
    }

    if (attempt.status === BillingCheckoutAttemptStatus.REVIEW_REQUIRED) {
      throw new ConflictException('Estamos confirmando seu checkout');
    }

    if (
      attempt.status === BillingCheckoutAttemptStatus.READY &&
      (paymentMethod === BillingPaymentMethod.PIX ||
        now - attempt.updatedAt.getTime() < READY_RECHECK_MS)
    ) {
      return { state: 'ready', attempt };
    }

    if (
      attempt.status === BillingCheckoutAttemptStatus.PROCESSING &&
      now - attempt.updatedAt.getTime() < MONTHLY_CHECKOUT_PROCESSING_LEASE_MS
    ) {
      throw new ConflictException('Monthly checkout is already being created. Try again shortly.');
    }

    if (
      attempt.status === BillingCheckoutAttemptStatus.PROCESSING ||
      attempt.status === BillingCheckoutAttemptStatus.READY
    ) {
      await this.prisma.monthlyCheckoutAttempt.updateMany({
        where: { id: attempt.id, organizationId, status: attempt.status },
        data: {
          status: BillingCheckoutAttemptStatus.REVIEW_REQUIRED,
          lastError: 'Checkout response requires authoritative reconciliation',
        },
      });
      throw new ConflictException('Estamos confirmando seu checkout');
    }

    throw new ConflictException('Monthly checkout is already being created. Try again shortly.');
  }

  async markReady(
    organizationId: string,
    claim: MonthlyCheckoutClaim,
    checkout: Extract<CheckoutResult, { mode: 'redirect' }>,
  ): Promise<void> {
    const updated = await this.prisma.monthlyCheckoutAttempt.updateMany({
      where: {
        id: claim.id,
        organizationId,
        status: BillingCheckoutAttemptStatus.PROCESSING,
      },
      data: {
        status: BillingCheckoutAttemptStatus.READY,
        externalCheckoutId: checkout.externalCheckoutId,
        externalCustomerId: checkout.externalCustomerId,
        checkoutUrl: checkout.url,
        lastError: null,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('Monthly checkout claim was lost. Try again.');
    }
  }

  async markPixReady(
    organizationId: string,
    claim: MonthlyCheckoutClaim,
    paymentId: string,
    externalCustomerId: string,
  ): Promise<void> {
    const updated = await this.prisma.monthlyCheckoutAttempt.updateMany({
      where: {
        id: claim.id,
        organizationId,
        status: BillingCheckoutAttemptStatus.PROCESSING,
      },
      data: {
        status: BillingCheckoutAttemptStatus.READY,
        externalCheckoutId: paymentId,
        externalCustomerId,
        lastError: null,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('Monthly PIX checkout claim was lost. Try again.');
    }
  }

  async markFailed(
    organizationId: string,
    claim: MonthlyCheckoutClaim,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Checkout failed';
    await this.prisma.monthlyCheckoutAttempt.updateMany({
      where: {
        id: claim.id,
        organizationId,
        status: BillingCheckoutAttemptStatus.PROCESSING,
      },
      data: {
        status: BillingCheckoutAttemptStatus.FAILED,
        lastError: message,
      },
    });
  }

  async markReviewRequired(
    organizationId: string,
    claim: MonthlyCheckoutClaim,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Checkout inconclusivo';
    await this.prisma.monthlyCheckoutAttempt.updateMany({
      where: {
        id: claim.id,
        organizationId,
        status: BillingCheckoutAttemptStatus.PROCESSING,
      },
      data: {
        status: BillingCheckoutAttemptStatus.REVIEW_REQUIRED,
        lastError: message,
      },
    });
  }

  async markResolved(externalId: string, externalCustomerId?: string): Promise<void> {
    await this.prisma.monthlyCheckoutAttempt.updateMany({
      where: {
        externalId,
        status: {
          in: [
            BillingCheckoutAttemptStatus.PROCESSING,
            BillingCheckoutAttemptStatus.READY,
            BillingCheckoutAttemptStatus.REVIEW_REQUIRED,
          ],
        },
      },
      data: {
        status: BillingCheckoutAttemptStatus.RESOLVED,
        ...(externalCustomerId ? { externalCustomerId } : {}),
        lastError: null,
      },
    });
  }

  async markPaymentFailed(externalId: string, reason: string): Promise<void> {
    await this.prisma.monthlyCheckoutAttempt.updateMany({
      where: {
        externalId,
        status: {
          in: [BillingCheckoutAttemptStatus.READY, BillingCheckoutAttemptStatus.REVIEW_REQUIRED],
        },
      },
      data: { status: BillingCheckoutAttemptStatus.FAILED, lastError: reason.slice(0, 500) },
    });
  }

  private async createOrFind(
    organizationId: string,
    paymentMethod: BillingPaymentMethod,
  ): Promise<{ attempt: MonthlyCheckoutAttempt; created: boolean }> {
    try {
      const attempt = await this.prisma.monthlyCheckoutAttempt.create({
        data: {
          organizationId,
          provider: PaymentProvider.ASAAS,
          paymentMethod,
          product: 'MONTHLY_ACCESS',
          amountCentavos: MONTHLY_PLAN_AMOUNT_CENTAVOS,
          currency: 'BRL',
          externalId: this.newExternalId(organizationId, paymentMethod),
        },
      });
      return { attempt, created: true };
    } catch (error) {
      if (!this.isUniqueConstraintViolation(error)) throw error;
      const existing = await this.prisma.monthlyCheckoutAttempt.findFirst({
        where: {
          organizationId,
          provider: PaymentProvider.ASAAS,
          status: {
            in: [
              BillingCheckoutAttemptStatus.PROCESSING,
              BillingCheckoutAttemptStatus.READY,
              BillingCheckoutAttemptStatus.REVIEW_REQUIRED,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!existing) {
        throw new ConflictException(
          'Monthly checkout is already being created. Try again shortly.',
        );
      }
      return { attempt: existing, created: false };
    }
  }

  private toCheckout(attempt: MonthlyCheckoutAttempt): CheckoutResult {
    if (!attempt.checkoutUrl) {
      throw new ConflictException('Monthly checkout is not ready. Try again shortly.');
    }
    return {
      mode: 'redirect',
      provider: 'ASAAS',
      url: attempt.checkoutUrl,
      ...(attempt.externalCheckoutId ? { externalCheckoutId: attempt.externalCheckoutId } : {}),
      ...(attempt.externalCustomerId ? { externalCustomerId: attempt.externalCustomerId } : {}),
    };
  }

  private newExternalId(organizationId: string, paymentMethod: BillingPaymentMethod): string {
    const method = paymentMethod === BillingPaymentMethod.PIX ? 'pix' : 'card';
    return `org:${organizationId}:monthly-${method}:${randomUUID()}`;
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}

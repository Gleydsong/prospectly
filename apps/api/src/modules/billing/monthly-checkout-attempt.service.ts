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
import type { CheckoutResult } from './domain/payment-provider';

const PROCESSING_LEASE_MS = 2 * 60 * 1000;
const READY_RECHECK_MS = 30 * 60 * 1000;

export type MonthlyCheckoutClaim = {
  id: string;
  externalId: string;
  recoverProviderState: boolean;
};

export type MonthlyCheckoutBeginResult =
  | { state: 'ready'; checkout: CheckoutResult }
  | { state: 'acquired'; claim: MonthlyCheckoutClaim };

@Injectable()
export class MonthlyCheckoutAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  async beginCard(organizationId: string): Promise<MonthlyCheckoutBeginResult> {
    const { attempt, created } = await this.createOrFind(organizationId);
    if (created) {
      return {
        state: 'acquired',
        claim: {
          id: attempt.id,
          externalId: attempt.externalId,
          recoverProviderState: false,
        },
      };
    }
    const now = Date.now();

    if (
      attempt.status === BillingCheckoutAttemptStatus.READY &&
      attempt.checkoutUrl &&
      now - attempt.updatedAt.getTime() < READY_RECHECK_MS
    ) {
      return { state: 'ready', checkout: this.toCheckout(attempt) };
    }

    if (
      attempt.status === BillingCheckoutAttemptStatus.PROCESSING &&
      now - attempt.updatedAt.getTime() < PROCESSING_LEASE_MS
    ) {
      throw new ConflictException('Monthly checkout is already being created. Try again shortly.');
    }

    const staleBefore = new Date(now - PROCESSING_LEASE_MS);
    const readyBefore = new Date(now - READY_RECHECK_MS);
    const claimed = await this.prisma.monthlyCheckoutAttempt.updateMany({
      where: {
        organizationId,
        id: attempt.id,
        OR: [
          { status: BillingCheckoutAttemptStatus.FAILED },
          {
            status: BillingCheckoutAttemptStatus.PROCESSING,
            updatedAt: { lt: staleBefore },
          },
          {
            status: BillingCheckoutAttemptStatus.READY,
            OR: [{ updatedAt: { lt: readyBefore } }, { checkoutUrl: null }],
          },
        ],
      },
      data: {
        status: BillingCheckoutAttemptStatus.PROCESSING,
        attempts: { increment: 1 },
        lastError: null,
      },
    });

    if (claimed.count !== 1) {
      throw new ConflictException('Monthly checkout is already being created. Try again shortly.');
    }

    return {
      state: 'acquired',
      claim: {
        id: attempt.id,
        externalId: attempt.externalId,
        recoverProviderState: true,
      },
    };
  }

  async rotateExternalId(
    organizationId: string,
    claim: MonthlyCheckoutClaim,
  ): Promise<MonthlyCheckoutClaim> {
    const externalId = this.newExternalId(organizationId);
    await this.prisma.monthlyCheckoutAttempt.update({
      where: { id: claim.id, organizationId },
      data: {
        externalId,
        externalCheckoutId: null,
        externalCustomerId: null,
        checkoutUrl: null,
      },
    });
    return { ...claim, externalId, recoverProviderState: false };
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

  private async createOrFind(
    organizationId: string,
  ): Promise<{ attempt: MonthlyCheckoutAttempt; created: boolean }> {
    try {
      const attempt = await this.prisma.monthlyCheckoutAttempt.create({
        data: {
          organizationId,
          provider: PaymentProvider.ABACATE,
          paymentMethod: BillingPaymentMethod.CARD,
          externalId: this.newExternalId(organizationId),
        },
      });
      return { attempt, created: true };
    } catch (error) {
      if (!this.isUniqueConstraintViolation(error)) throw error;
      const existing = await this.prisma.monthlyCheckoutAttempt.findUnique({
        where: {
          organizationId_provider_paymentMethod: {
            organizationId,
            provider: PaymentProvider.ABACATE,
            paymentMethod: BillingPaymentMethod.CARD,
          },
        },
      });
      if (!existing) {
        throw new ConflictException('Monthly checkout is already being created. Try again shortly.');
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
      provider: 'ABACATE',
      url: attempt.checkoutUrl,
      ...(attempt.externalCheckoutId
        ? { externalCheckoutId: attempt.externalCheckoutId }
        : {}),
      ...(attempt.externalCustomerId
        ? { externalCustomerId: attempt.externalCustomerId }
        : {}),
    };
  }

  private newExternalId(organizationId: string): string {
    return `org:${organizationId}:monthly-card:${randomUUID()}`;
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}

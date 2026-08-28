import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AsaasWebhookService } from './asaas-webhook.service';
import { BillingActivationService } from './billing-activation.service';
import { CreditPurchaseService } from './credit-purchase.service';
import { AsaasClient } from './infrastructure/asaas.client';
import { MonthlyCheckoutAttemptService } from './monthly-checkout-attempt.service';

describe('AsaasWebhookService', () => {
  const payload = {
    id: 'evt_1',
    event: 'PAYMENT_CONFIRMED',
    payment: { id: 'pay_1' },
  };
  const prisma = {
    billingWebhookEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    creditPurchase: { findUnique: jest.fn(), findMany: jest.fn() },
    billingProfile: { findUnique: jest.fn() },
    monthlyCheckoutAttempt: { findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    organization: { findUnique: jest.fn() },
  };
  const client = { getPayment: jest.fn(), findPayment: jest.fn() };
  const purchases = { completeById: jest.fn(), refundById: jest.fn() };
  const activation = { activateMonthly: jest.fn(), syncMonthlyStatus: jest.fn() };
  const monthlyAttempts = {
    markResolved: jest.fn(),
    markPaymentFailed: jest.fn(),
    markReviewRequired: jest.fn(),
  };
  let service: AsaasWebhookService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.billingWebhookEvent.findMany.mockResolvedValue([]);
    prisma.creditPurchase.findMany.mockResolvedValue([]);
    prisma.monthlyCheckoutAttempt.findMany.mockResolvedValue([]);
    prisma.organization.findUnique.mockResolvedValue(null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsaasWebhookService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'asaas.enabled' ? true : 'webhook-secret'),
          },
        },
        { provide: AsaasClient, useValue: client },
        { provide: CreditPurchaseService, useValue: purchases },
        { provide: BillingActivationService, useValue: activation },
        { provide: MonthlyCheckoutAttemptService, useValue: monthlyAttempts },
      ],
    }).compile();
    service = module.get(AsaasWebhookService);
  });

  it('persists an authenticated event before acknowledging it', async () => {
    prisma.billingWebhookEvent.create.mockResolvedValue({ id: 'inbox-1' });

    await expect(
      service.ingest(Buffer.from(JSON.stringify(payload)), {
        'asaas-access-token': 'webhook-secret',
      }),
    ).resolves.toEqual({ received: true });

    expect(prisma.billingWebhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: 'ASAAS',
        eventId: 'evt_1',
        type: 'PAYMENT_CONFIRMED',
        payload,
      }),
    });
    expect(client.getPayment).not.toHaveBeenCalled();
  });

  it('confirms a matching package only after the authoritative payment read', async () => {
    prisma.billingWebhookEvent.findUnique.mockResolvedValue({
      id: 'inbox-1',
      provider: 'ASAAS',
      eventId: 'evt_1',
      type: 'PAYMENT_CONFIRMED',
      status: 'PENDING',
      payload,
    });
    prisma.creditPurchase.findUnique.mockResolvedValue({
      id: 'purchase-1',
      organizationId: 'org-1',
      amountCentavos: 1499,
      externalId: 'org:org-1:credits:purchase-1',
      provider: 'ASAAS',
    });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    client.getPayment.mockResolvedValue({
      id: 'pay_1',
      customer: 'cus_1',
      value: 14.99,
      externalReference: 'org:org-1:credits:purchase-1',
      billingType: 'CREDIT_CARD',
      status: 'CONFIRMED',
    });
    prisma.billingWebhookEvent.updateMany.mockResolvedValue({ count: 1 });

    await service.processEvent('evt_1');

    expect(purchases.completeById).toHaveBeenCalledWith('purchase-1', 'pay_1');
    expect(prisma.billingWebhookEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PROCESSED' }) }),
    );
  });

  it('confirms a package when authoritative status already advanced to RECEIVED', async () => {
    prisma.billingWebhookEvent.findUnique.mockResolvedValue({
      id: 'inbox-1',
      provider: 'ASAAS',
      eventId: 'evt_1',
      type: 'PAYMENT_CONFIRMED',
      status: 'PENDING',
      payload,
    });
    prisma.creditPurchase.findUnique.mockResolvedValue({
      id: 'purchase-1',
      organizationId: 'org-1',
      amountCentavos: 1499,
      externalId: 'org:org-1:credits:purchase-1',
      provider: 'ASAAS',
    });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    client.getPayment.mockResolvedValue({
      id: 'pay_1',
      customer: 'cus_1',
      value: 14.99,
      externalReference: 'org:org-1:credits:purchase-1',
      billingType: 'CREDIT_CARD',
      status: 'RECEIVED',
    });
    prisma.billingWebhookEvent.updateMany.mockResolvedValue({ count: 1 });

    await service.processEvent('evt_1');

    expect(purchases.completeById).toHaveBeenCalledWith('purchase-1', 'pay_1');
  });

  it('fulfills a still-pending package from PAYMENT_RECEIVED after CONFIRMED was missed', async () => {
    prisma.billingWebhookEvent.findUnique.mockResolvedValue({
      id: 'inbox-1',
      provider: 'ASAAS',
      eventId: 'evt_received',
      type: 'PAYMENT_RECEIVED',
      status: 'PENDING',
      payload: { ...payload, id: 'evt_received', event: 'PAYMENT_RECEIVED' },
    });
    prisma.creditPurchase.findUnique.mockResolvedValue({
      id: 'purchase-1',
      organizationId: 'org-1',
      amountCentavos: 1499,
      externalId: 'org:org-1:credits:purchase-1',
      provider: 'ASAAS',
    });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    client.getPayment.mockResolvedValue({
      id: 'pay_1',
      customer: 'cus_1',
      value: 14.99,
      externalReference: 'org:org-1:credits:purchase-1',
      billingType: 'CREDIT_CARD',
      status: 'RECEIVED',
    });
    prisma.billingWebhookEvent.updateMany.mockResolvedValue({ count: 1 });

    await service.processEvent('evt_received');

    expect(purchases.completeById).toHaveBeenCalledWith('purchase-1', 'pay_1');
  });

  it('extends an active Asaas subscription when a renewal lacks the original checkout reference', async () => {
    prisma.billingWebhookEvent.findUnique.mockResolvedValue({
      type: 'PAYMENT_CONFIRMED',
      payload,
    });
    prisma.billingWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.creditPurchase.findUnique.mockResolvedValue(null);
    prisma.monthlyCheckoutAttempt.findUnique.mockResolvedValue(null);
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    client.getPayment.mockResolvedValue({
      id: 'pay_renewal',
      customer: 'cus_1',
      value: 49.99,
      billingType: 'CREDIT_CARD',
      status: 'RECEIVED',
      subscription: 'sub_live',
      dueDate: '2026-09-25',
    });

    await service.processEvent('evt_1');

    expect(prisma.organization.findUnique).toHaveBeenCalledWith({
      where: { asaasSubscriptionId: 'sub_live' },
      select: { id: true },
    });
    expect(activation.activateMonthly).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        provider: 'ASAAS',
        asaasSubscriptionId: 'sub_live',
      }),
    );
    expect(monthlyAttempts.markResolved).not.toHaveBeenCalled();
  });

  it('does not reverse a package until Asaas reports the matching reversed status', async () => {
    prisma.billingWebhookEvent.findUnique.mockResolvedValue({
      type: 'PAYMENT_REFUNDED',
      payload: { ...payload, event: 'PAYMENT_REFUNDED' },
    });
    prisma.billingWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.creditPurchase.findUnique.mockResolvedValue({
      id: 'purchase-1',
      organizationId: 'org-1',
      amountCentavos: 1499,
      externalId: 'org:org-1:credits:purchase-1',
    });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    client.getPayment.mockResolvedValue({
      id: 'pay_1',
      customer: 'cus_1',
      value: 14.99,
      externalReference: 'org:org-1:credits:purchase-1',
      billingType: 'CREDIT_CARD',
      status: 'CONFIRMED',
    });

    await service.processEvent('evt_1');

    expect(purchases.refundById).not.toHaveBeenCalled();
  });

  it('resolves the monthly review lock after authoritative confirmation', async () => {
    prisma.billingWebhookEvent.findUnique.mockResolvedValue({
      type: 'PAYMENT_CONFIRMED',
      payload,
    });
    prisma.billingWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.creditPurchase.findUnique.mockResolvedValue(null);
    prisma.monthlyCheckoutAttempt.findUnique.mockResolvedValue({
      organizationId: 'org-1',
      externalId: 'org:org-1:monthly-card:attempt-1',
      product: 'MONTHLY_ACCESS',
      amountCentavos: 4999,
      currency: 'BRL',
    });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    client.getPayment.mockResolvedValue({
      id: 'pay_1',
      customer: 'cus_1',
      value: 49.99,
      externalReference: 'org:org-1:monthly-card:attempt-1',
      billingType: 'CREDIT_CARD',
      status: 'CONFIRMED',
      subscription: 'sub_1',
      dueDate: '2026-08-25',
    });

    await service.processEvent('evt_1');

    expect(activation.activateMonthly).toHaveBeenCalled();
    expect(monthlyAttempts.markResolved).toHaveBeenCalledWith(
      'org:org-1:monthly-card:attempt-1',
      'cus_1',
    );
  });

  it('rejects debit as a recurring monthly payment method', async () => {
    prisma.billingWebhookEvent.findUnique.mockResolvedValue({
      type: 'PAYMENT_CONFIRMED',
      payload,
    });
    prisma.billingWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.creditPurchase.findUnique.mockResolvedValue(null);
    prisma.monthlyCheckoutAttempt.findUnique.mockResolvedValue({
      organizationId: 'org-1',
      externalId: 'org:org-1:monthly-card:attempt-1',
      product: 'MONTHLY_ACCESS',
      amountCentavos: 4999,
      currency: 'BRL',
    });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    client.getPayment.mockResolvedValue({
      id: 'pay_1',
      customer: 'cus_1',
      value: 49.99,
      externalReference: 'org:org-1:monthly-card:attempt-1',
      billingType: 'DEBIT_CARD',
      status: 'CONFIRMED',
      subscription: 'sub_1',
    });

    await expect(service.processEvent('evt_1')).rejects.toThrow(
      'Asaas payment does not match the Prospectly checkout',
    );
    expect(activation.activateMonthly).not.toHaveBeenCalled();
  });

  it('keeps an intermediate chargeback in durable review', async () => {
    prisma.billingWebhookEvent.findUnique.mockResolvedValue({
      type: 'PAYMENT_CHARGEBACK_REQUESTED',
      payload: { ...payload, event: 'PAYMENT_CHARGEBACK_REQUESTED' },
    });
    prisma.billingWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.creditPurchase.findUnique.mockResolvedValue({
      id: 'purchase-1',
      organizationId: 'org-1',
      amountCentavos: 1499,
      externalId: 'org:org-1:credits:purchase-1',
    });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    client.getPayment.mockResolvedValue({
      id: 'pay_1',
      customer: 'cus_1',
      value: 14.99,
      externalReference: 'org:org-1:credits:purchase-1',
      billingType: 'CREDIT_CARD',
      status: 'CHARGEBACK_REQUESTED',
      chargebackStatus: 'REQUESTED',
    });

    await expect(service.processEvent('evt_1')).rejects.toThrow('Asaas chargeback is not terminal');
    expect(purchases.refundById).not.toHaveBeenCalled();
    expect(prisma.billingWebhookEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REVIEW_REQUIRED' }),
      }),
    );
  });

  it('reconciles a review-required package by external reference without creating a retry', async () => {
    prisma.creditPurchase.findMany.mockResolvedValue([
      {
        id: 'purchase-review',
        organizationId: 'org-1',
        externalId: 'org:org-1:credits:review',
        externalPaymentId: null,
      },
    ]);
    prisma.creditPurchase.findUnique.mockResolvedValue({
      id: 'purchase-review',
      organizationId: 'org-1',
      amountCentavos: 1499,
      externalId: 'org:org-1:credits:review',
    });
    prisma.billingProfile.findUnique.mockResolvedValue({ asaasCustomerId: 'cus_1' });
    client.findPayment.mockResolvedValue({
      id: 'pay_recovered',
      customer: 'cus_1',
      value: 14.99,
      externalReference: 'org:org-1:credits:review',
      billingType: 'CREDIT_CARD',
      status: 'CONFIRMED',
    });

    await service.processPending();

    expect(client.findPayment).toHaveBeenCalledWith({
      externalReference: 'org:org-1:credits:review',
    });
    expect(purchases.completeById).toHaveBeenCalledWith('purchase-review', 'pay_recovered');
  });

  it('reconciles a monthly checkout whose processing lease expired', async () => {
    const staleAttempt = {
      id: 'attempt-stale',
      organizationId: 'org-1',
      externalId: 'org:org-1:monthly-card:stale',
      externalCheckoutId: null,
      status: 'PROCESSING',
      updatedAt: new Date(Date.now() - 3 * 60 * 1000),
    };
    prisma.monthlyCheckoutAttempt.findMany.mockImplementation(async ({ where }) =>
      JSON.stringify(where).includes('PROCESSING') ? [staleAttempt] : [],
    );
    client.findPayment.mockResolvedValue(null);

    await service.processPending();

    expect(client.findPayment).toHaveBeenCalledWith({
      externalReference: staleAttempt.externalId,
    });
    expect(monthlyAttempts.markReviewRequired).toHaveBeenCalledWith(
      staleAttempt.organizationId,
      { id: staleAttempt.id, externalId: staleAttempt.externalId },
      expect.objectContaining({
        message: 'Checkout response requires authoritative reconciliation',
      }),
    );
  });
});

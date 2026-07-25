import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgPlan, PlanStatus } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingService } from './billing.service';

const constructEvent = jest.fn();
const checkoutSessionsCreate = jest.fn();
const billingPortalSessionsCreate = jest.fn();
const customersCreate = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent },
    checkout: { sessions: { create: checkoutSessionsCreate } },
    billingPortal: { sessions: { create: billingPortalSessionsCreate } },
    customers: { create: customersCreate },
  }));
});

describe('BillingService', () => {
  let service: BillingService;
  const prisma = {
    organization: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    search: {
      count: jest.fn(),
    },
  };

  const configGet = jest.fn((key: string) => {
    const map: Record<string, string> = {
      'stripe.secretKey': 'sk_test_123',
      'stripe.webhookSecret': 'whsec_test',
      'stripe.prices.monthly.brl': 'price_monthly_brl',
      'stripe.prices.lifetime.brl': 'price_lifetime_brl',
      'stripe.successUrl': 'https://app.test/success',
      'stripe.cancelUrl': 'https://app.test/cancel',
      frontendUrl: 'https://app.test',
    };
    return map[key];
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();
    service = module.get(BillingService);
  });

  it('allows searches when plan is ACTIVE', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      planStatus: PlanStatus.ACTIVE,
      deletedAt: null,
    });
    await expect(service.assertCanCreateSearch('org1')).resolves.toBeUndefined();
  });

  it('blocks free org after 3 searches', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      planStatus: PlanStatus.INACTIVE,
      plan: OrgPlan.FREE,
      deletedAt: null,
    });
    prisma.search.count.mockResolvedValue(3);
    await expect(service.assertCanCreateSearch('org1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates monthly checkout session', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      name: 'Acme',
      stripeCustomerId: 'cus_1',
      deletedAt: null,
    });
    checkoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/test' });

    const result = await service.createCheckoutSession('org1', 'a@b.com', 'monthly', 'BRL');
    expect(result.url).toContain('checkout.stripe.com');
    expect(checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_1',
      }),
    );
  });

  it('rejects invalid webhook signature', async () => {
    constructEvent.mockImplementation(() => {
      throw new Error('bad sig');
    });
    await expect(service.handleWebhook(Buffer.from('{}'), 'sig')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('activates LIFETIME on checkout.session.completed when paid', async () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_paid',
          mode: 'payment',
          payment_status: 'paid',
          metadata: { organizationId: 'org1', interval: 'lifetime', currency: 'BRL' },
          customer: 'cus_1',
        },
      },
    });
    prisma.organization.update.mockResolvedValue({});

    await service.handleWebhook(Buffer.from('{}'), 'sig');
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org1' },
      data: expect.objectContaining({
        plan: OrgPlan.LIFETIME,
        planStatus: PlanStatus.ACTIVE,
      }),
    });
  });

  it('does not activate LIFETIME on unpaid checkout.session.completed', async () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_unpaid',
          mode: 'payment',
          payment_status: 'unpaid',
          metadata: { organizationId: 'org1', interval: 'lifetime', currency: 'BRL' },
          customer: 'cus_1',
        },
      },
    });

    await service.handleWebhook(Buffer.from('{}'), 'sig');
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it('activates LIFETIME on checkout.session.async_payment_succeeded', async () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.async_payment_succeeded',
      data: {
        object: {
          id: 'cs_async',
          mode: 'payment',
          payment_status: 'paid',
          metadata: { organizationId: 'org1', interval: 'lifetime', currency: 'BRL' },
          customer: 'cus_1',
        },
      },
    });
    prisma.organization.update.mockResolvedValue({});

    await service.handleWebhook(Buffer.from('{}'), 'sig');
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org1' },
      data: expect.objectContaining({
        plan: OrgPlan.LIFETIME,
        planStatus: PlanStatus.ACTIVE,
      }),
    });
  });

  it('ignores invoice.paid when subscription does not match org', async () => {
    constructEvent.mockReturnValue({
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_stale',
          customer: 'cus_1',
          parent: {
            subscription_details: { subscription: 'sub_old' },
          },
        },
      },
    });
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.FREE,
      planStatus: PlanStatus.CANCELED,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: null,
    });

    await service.handleWebhook(Buffer.from('{}'), 'sig');
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it('reactivates plan on invoice.paid for the current subscription', async () => {
    constructEvent.mockReturnValue({
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_current',
          customer: 'cus_1',
          parent: {
            subscription_details: { subscription: 'sub_current' },
          },
        },
      },
    });
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.STARTER_MONTHLY,
      planStatus: PlanStatus.PAST_DUE,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_current',
    });
    prisma.organization.update.mockResolvedValue({});

    await service.handleWebhook(Buffer.from('{}'), 'sig');
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org1' },
      data: {
        planStatus: PlanStatus.ACTIVE,
        plan: OrgPlan.STARTER_MONTHLY,
      },
    });
  });
});

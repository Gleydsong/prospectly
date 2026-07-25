import { OrgPlan, PaymentProvider, PlanStatus } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingActivationService } from './billing-activation.service';

describe('BillingActivationService', () => {
  let service: BillingActivationService;
  const prisma = {
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingActivationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(BillingActivationService);
  });

  it('activates lifetime plan', async () => {
    prisma.organization.update.mockResolvedValue({});
    await service.activateLifetime({
      organizationId: 'org1',
      currency: 'BRL',
      provider: PaymentProvider.ABACATE,
      abacatePaymentId: 'pix_1',
    });
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org1' },
      data: expect.objectContaining({
        plan: OrgPlan.LIFETIME,
        planStatus: PlanStatus.ACTIVE,
        paymentProvider: PaymentProvider.ABACATE,
        abacatePaymentId: 'pix_1',
      }),
    });
  });

  it('activates monthly plan', async () => {
    prisma.organization.update.mockResolvedValue({});
    await service.activateMonthly({
      organizationId: 'org1',
      currency: 'EUR',
      provider: PaymentProvider.STRIPE,
      stripeSubscriptionId: 'sub_1',
    });
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org1' },
      data: expect.objectContaining({
        plan: OrgPlan.STARTER_MONTHLY,
        planStatus: PlanStatus.ACTIVE,
        paymentProvider: PaymentProvider.STRIPE,
        stripeSubscriptionId: 'sub_1',
      }),
    });
  });

  it('does not downgrade lifetime on cancel sync', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.LIFETIME,
    });
    await service.syncMonthlyStatus({
      organizationId: 'org1',
      status: PlanStatus.CANCELED,
    });
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it('cancels monthly to FREE', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org1',
      plan: OrgPlan.STARTER_MONTHLY,
    });
    prisma.organization.update.mockResolvedValue({});
    await service.syncMonthlyStatus({
      organizationId: 'org1',
      status: PlanStatus.CANCELED,
      abacateSubscriptionId: 'subs_1',
    });
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org1' },
      data: expect.objectContaining({
        plan: OrgPlan.FREE,
        planStatus: PlanStatus.CANCELED,
      }),
    });
  });
});

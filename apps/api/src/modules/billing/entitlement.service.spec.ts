import { ForbiddenException } from '@nestjs/common';
import { CreditPurchaseStatus, OrgPlan, PlanStatus } from '@prisma/client';

import { EntitlementService } from './entitlement.service';

describe('EntitlementService', () => {
  const prisma = {
    organization: { findUniqueOrThrow: jest.fn() },
    organizationMember: { count: jest.fn() },
    creditPurchase: { count: jest.fn() },
  };

  const service = new EntitlementService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('treats expired monthly as FREE for snapshot limits', async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      plan: OrgPlan.STARTER_MONTHLY,
      planStatus: PlanStatus.ACTIVE,
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
    });
    prisma.organizationMember.count.mockResolvedValue(1);

    const snapshot = await service.getSnapshot('org-1');
    expect(snapshot.plan).toBe(OrgPlan.FREE);
    expect(snapshot.limits.teamMembers).toBe(2);
    expect(snapshot.limits.csvExport).toBe(false);
  });

  it('keeps Asaas card entitlement when the invoice period lapses', async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      plan: OrgPlan.STARTER_MONTHLY,
      planStatus: PlanStatus.ACTIVE,
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
      asaasSubscriptionId: 'sub_asaas_card',
    });
    prisma.organizationMember.count.mockResolvedValue(1);

    const snapshot = await service.getSnapshot('org-1');
    expect(snapshot.plan).toBe(OrgPlan.STARTER_MONTHLY);
    expect(snapshot.limits.csvExport).toBe(true);
  });

  it('allows CSV export after a completed credit purchase', async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      plan: OrgPlan.FREE,
      planStatus: PlanStatus.INACTIVE,
      currentPeriodEnd: null,
    });
    prisma.creditPurchase.count.mockResolvedValue(1);

    await expect(service.canExportCsv('org-1')).resolves.toBe(true);
    expect(prisma.creditPurchase.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', status: CreditPurchaseStatus.COMPLETED },
    });
  });

  it('blocks a new seat when the FREE cap is reached', async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      plan: OrgPlan.FREE,
      planStatus: PlanStatus.INACTIVE,
      currentPeriodEnd: null,
    });
    prisma.organizationMember.count.mockResolvedValue(2);

    await expect(service.assertTeamSeat('org-1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

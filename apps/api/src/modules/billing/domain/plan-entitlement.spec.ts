import { OrgPlan, PlanStatus } from '@prisma/client';

import { effectivePlan, hasActivePaidEntitlement } from './plan-entitlement';

describe('plan entitlement period expiry', () => {
  it('keeps ACTIVE monthly plans before currentPeriodEnd', () => {
    expect(
      effectivePlan({
        plan: OrgPlan.STARTER_MONTHLY,
        planStatus: PlanStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 60_000),
      }),
    ).toBe(OrgPlan.STARTER_MONTHLY);
  });

  it('expires ACTIVE monthly plans after currentPeriodEnd', () => {
    expect(
      effectivePlan({
        plan: OrgPlan.STARTER_MONTHLY,
        planStatus: PlanStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() - 1_000),
      }),
    ).toBe(OrgPlan.FREE);
  });

  it('does not expire monthly plans with null currentPeriodEnd (Stripe/legacy)', () => {
    expect(
      effectivePlan({
        plan: OrgPlan.STARTER_MONTHLY,
        planStatus: PlanStatus.ACTIVE,
        currentPeriodEnd: null,
      }),
    ).toBe(OrgPlan.STARTER_MONTHLY);
  });

  it('never expires LIFETIME via currentPeriodEnd', () => {
    expect(
      effectivePlan({
        plan: OrgPlan.LIFETIME,
        planStatus: PlanStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() - 1_000),
      }),
    ).toBe(OrgPlan.LIFETIME);
  });

  it('reports paid entitlement only while the effective plan is paid', () => {
    expect(
      hasActivePaidEntitlement({
        plan: OrgPlan.STARTER_MONTHLY,
        planStatus: PlanStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() - 1),
      }),
    ).toBe(false);
    expect(
      hasActivePaidEntitlement({
        plan: OrgPlan.LIFETIME,
        planStatus: PlanStatus.ACTIVE,
        currentPeriodEnd: null,
      }),
    ).toBe(true);
  });
});

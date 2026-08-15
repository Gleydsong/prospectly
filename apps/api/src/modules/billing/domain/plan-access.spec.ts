import { OrgPlan, PlanStatus } from '@prisma/client';

import { hasUnlimitedAccess, isMonthlyPeriodExpired } from './plan-access';

const now = new Date('2026-08-15T12:00:00.000Z');

describe('hasUnlimitedAccess', () => {
  it('is true for ACTIVE monthly without period end', () => {
    expect(
      hasUnlimitedAccess(
        { plan: OrgPlan.STARTER_MONTHLY, planStatus: PlanStatus.ACTIVE, currentPeriodEnd: null },
        now,
      ),
    ).toBe(true);
  });

  it('is false when monthly period already ended', () => {
    expect(
      hasUnlimitedAccess(
        {
          plan: OrgPlan.STARTER_MONTHLY,
          planStatus: PlanStatus.ACTIVE,
          currentPeriodEnd: new Date('2026-08-14T12:00:00.000Z'),
        },
        now,
      ),
    ).toBe(false);
  });

  it('keeps LIFETIME active even with a stale period end', () => {
    expect(
      hasUnlimitedAccess(
        {
          plan: OrgPlan.LIFETIME,
          planStatus: PlanStatus.ACTIVE,
          currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe(true);
  });

  it('is false for FREE / inactive', () => {
    expect(
      hasUnlimitedAccess(
        { plan: OrgPlan.FREE, planStatus: PlanStatus.INACTIVE, currentPeriodEnd: null },
        now,
      ),
    ).toBe(false);
  });
});

describe('isMonthlyPeriodExpired', () => {
  it('detects expired STARTER_MONTHLY', () => {
    expect(
      isMonthlyPeriodExpired(
        {
          plan: OrgPlan.STARTER_MONTHLY,
          planStatus: PlanStatus.ACTIVE,
          currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe(true);
  });

  it('does not expire LIFETIME', () => {
    expect(
      isMonthlyPeriodExpired(
        {
          plan: OrgPlan.LIFETIME,
          planStatus: PlanStatus.ACTIVE,
          currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe(false);
  });
});

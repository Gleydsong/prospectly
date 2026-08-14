import { OrgPlan, PlanStatus } from '@prisma/client';

export interface PlanEntitlementContext {
  plan: OrgPlan;
  planStatus: PlanStatus;
  /** When set on STARTER_MONTHLY, entitlement ends at this instant (PIX 30-day window). */
  currentPeriodEnd?: Date | null;
}

/**
 * Paid plans stay entitled only while ACTIVE.
 * STARTER_MONTHLY with a past `currentPeriodEnd` is treated as expired even if
 * `planStatus` is still ACTIVE (Abacate PIX has no auto-renew webhook).
 */
export function effectivePlan({
  plan,
  planStatus,
  currentPeriodEnd,
}: PlanEntitlementContext): OrgPlan {
  if (planStatus !== PlanStatus.ACTIVE) return OrgPlan.FREE;
  if (
    plan === OrgPlan.STARTER_MONTHLY &&
    currentPeriodEnd != null &&
    currentPeriodEnd.getTime() <= Date.now()
  ) {
    return OrgPlan.FREE;
  }
  return plan;
}

/** True when the org currently has unlimited-search paid entitlement. */
export function hasActivePaidEntitlement(context: PlanEntitlementContext): boolean {
  const plan = effectivePlan(context);
  return plan === OrgPlan.STARTER_MONTHLY || plan === OrgPlan.LIFETIME;
}

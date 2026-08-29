import { OrgPlan, PlanStatus } from '@prisma/client';

export type PlanAccessOrg = {
  plan: OrgPlan;
  planStatus: PlanStatus;
  currentPeriodEnd: Date | null;
  /** Open-ended card subscriptions stay active until cancelled; not bound to PIX period end. */
  abacateSubscriptionId?: string | null;
  asaasSubscriptionId?: string | null;
};

function hasRecurringCardSubscription(org: PlanAccessOrg): boolean {
  return Boolean(org.abacateSubscriptionId || org.asaasSubscriptionId);
}

/** ACTIVE paid access. LIFETIME never expires. Monthly PIX expires at currentPeriodEnd. */
export function hasUnlimitedAccess(org: PlanAccessOrg, now = new Date()): boolean {
  if (org.planStatus !== PlanStatus.ACTIVE) {
    return false;
  }
  if (org.plan === OrgPlan.LIFETIME) {
    return true;
  }
  if (
    org.currentPeriodEnd &&
    org.currentPeriodEnd.getTime() <= now.getTime() &&
    !hasRecurringCardSubscription(org)
  ) {
    return false;
  }
  return true;
}

export function isMonthlyPeriodExpired(org: PlanAccessOrg, now = new Date()): boolean {
  return (
    org.plan !== OrgPlan.LIFETIME &&
    org.planStatus === PlanStatus.ACTIVE &&
    org.currentPeriodEnd != null &&
    org.currentPeriodEnd.getTime() <= now.getTime() &&
    !hasRecurringCardSubscription(org)
  );
}

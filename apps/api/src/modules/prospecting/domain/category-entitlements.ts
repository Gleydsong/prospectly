import { OrgPlan, PlanStatus } from '@prisma/client';
import {
  FREE_PROSPECTING_CATEGORIES,
  PROSPECTING_CATEGORIES,
  isFreeProspectingCategory,
  type ProspectingCategory,
  type ProspectingCategoryOption,
} from '@prospectly/shared-types';

export const CATEGORY_REQUIRED_PLAN = OrgPlan.STARTER_MONTHLY;

export interface PlanContext {
  plan: OrgPlan;
  planStatus: PlanStatus;
  /** When set on STARTER_MONTHLY, entitlement ends at this instant (PIX 30-day window). */
  currentPeriodEnd?: Date | null;
}

/**
 * Paid plans unlock the whole catalog; everything else falls back to the free subset.
 * STARTER_MONTHLY with a past `currentPeriodEnd` is treated as expired even if
 * `planStatus` is still ACTIVE (Abacate PIX has no auto-renew webhook).
 */
export function effectivePlan({ plan, planStatus, currentPeriodEnd }: PlanContext): OrgPlan {
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
export function hasActivePaidEntitlement(context: PlanContext): boolean {
  const plan = effectivePlan(context);
  return plan === OrgPlan.STARTER_MONTHLY || plan === OrgPlan.LIFETIME;
}

export function isCategoryAvailable(plan: OrgPlan, category: string): boolean {
  return plan !== OrgPlan.FREE || isFreeProspectingCategory(category);
}

export function listCategoryOptions(plan: OrgPlan): ProspectingCategoryOption[] {
  return PROSPECTING_CATEGORIES.map((category) => ({
    value: category.value as ProspectingCategory,
    label: category.label,
    available: isCategoryAvailable(plan, category.value),
  }));
}

export function availableCategoryCount(plan: OrgPlan): number {
  return plan === OrgPlan.FREE
    ? FREE_PROSPECTING_CATEGORIES.length
    : PROSPECTING_CATEGORIES.length;
}

import { OrgPlan } from '@prisma/client';
import {
  FREE_PROSPECTING_CATEGORIES,
  PROSPECTING_CATEGORIES,
  isFreeProspectingCategory,
  type ProspectingCategory,
  type ProspectingCategoryOption,
} from '@prospectly/shared-types';

import {
  effectivePlan as resolveEffectivePlan,
  type PlanEntitlementContext,
} from '../../billing/domain/plan-entitlement';

export const CATEGORY_REQUIRED_PLAN = OrgPlan.STARTER_MONTHLY;

export type PlanContext = PlanEntitlementContext;

/** Paid plans unlock the whole catalog; everything else falls back to the free subset. */
export function effectivePlan(context: PlanContext): OrgPlan {
  return resolveEffectivePlan(context);
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

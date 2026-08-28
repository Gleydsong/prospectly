/** Keep in sync with @prospectly/shared-types CREDIT_COSTS. */
export const CREDIT_COSTS = {
  mapsSearch: 14,
  opportunityFinder: 16,
  explain: 8,
  saveLead: 1,
} as const;

export const TERMS_VERSION = '2026-08-17';
export const PRIVACY_POLICY_VERSION = '2026-08-17';
export const FREE_SEARCH_LIMIT = 3;
export const MONTHLY_PLAN_AMOUNT_CENTAVOS = 4_999;
/** Credits debited per Maps search after the free quota is exhausted. */
export const CREDITS_PER_SEARCH = CREDIT_COSTS.mapsSearch;
/** Starting creditBalance for every newly provisioned organization. */
export const SIGNUP_BONUS_CREDITS = 400;

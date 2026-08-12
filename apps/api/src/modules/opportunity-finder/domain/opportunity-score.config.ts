import type { OpportunityFinderSignalType } from '@prospectly/shared-types';

export const OPPORTUNITY_SCORE_CONFIG = {
  need: {
    MISSING_WEBSITE: 45,
    LOW_PERFORMANCE: 18,
    MISSING_HTTPS: 10,
    MISSING_MOBILE_SUPPORT: 12,
    MISSING_BOOKING: 8,
    MISSING_CONTACT_FORM: 7,
  } satisfies Partial<Record<OpportunityFinderSignalType, number>>,
  quality: { HIGH_RATING: 55, HIGH_REVIEW_COUNT: 30, ACTIVE_BUSINESS: 15 },
  qualityDefaults: { ratingUnknownOrLow: 15, reviewsUnknownOrLow: 10 },
  reach: { CONTACT_AVAILABLE: 70, WEBSITE_AVAILABLE: 20, WHATSAPP_AVAILABLE: 10 },
  reachDefault: 15,
  timing: { base: 35, needFactor: 0.5, qualityFactor: 0.15 },
  fit: { categoryMatch: 100, knownCategory: 65, unknownCategory: 45 },
  overall: { need: 0.35, quality: 0.2, reach: 0.15, timing: 0.1, fit: 0.2 },
  ranking: { excellent: 85, high: 70, medium: 45 },
  confidence: { completeness: 0.65, evidence: 35 },
} as const;

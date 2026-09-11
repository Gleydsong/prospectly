import {
  PROSPECTING_CATEGORY_VALUES,
  type OpportunityFinderSignalType,
  type OpportunityProfile,
  type OpportunitySearchStrategy,
  type ProspectingCategory,
} from '@prospectly/shared-types';
import { z } from 'zod';

export { resolveOpportunityNiche } from './niche-variants';
export type { OpportunityNicheResolution } from './niche-variants';

const signalValues = [
  'MISSING_WEBSITE', 'LOW_PERFORMANCE', 'MISSING_HTTPS', 'MISSING_MOBILE_SUPPORT',
  'MISSING_BOOKING', 'MISSING_WHATSAPP', 'MISSING_CONTACT_FORM', 'HIGH_REVIEW_COUNT',
  'HIGH_RATING', 'CONTACT_AVAILABLE', 'ACTIVE_BUSINESS',
] as const satisfies readonly OpportunityFinderSignalType[];

export const OpportunityProfileSchema = z.object({
  service: z.string().trim().min(3).max(240),
  niche: z.string().trim().min(2).max(120).optional(),
  targetCustomer: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
  relevantSignals: z.array(z.enum(signalValues)).min(1).max(signalValues.length),
  categories: z.array(z.enum(PROSPECTING_CATEGORY_VALUES)).max(10),
});

export const OpportunitySearchStrategySchema = z.object({
  categories: z.array(z.enum(PROSPECTING_CATEGORY_VALUES)).max(10),
  minimumRating: z.number().min(0).max(5).nullable(),
  minimumReviews: z.number().int().min(0).max(100_000).nullable(),
  relevantSignals: z.array(z.enum(signalValues)).min(1).max(signalValues.length),
});

const DEFAULT_SIGNALS: OpportunityFinderSignalType[] = [
  'MISSING_WEBSITE', 'LOW_PERFORMANCE', 'MISSING_HTTPS', 'MISSING_MOBILE_SUPPORT',
  'MISSING_BOOKING', 'MISSING_WHATSAPP', 'MISSING_CONTACT_FORM', 'HIGH_REVIEW_COUNT',
  'HIGH_RATING', 'CONTACT_AVAILABLE', 'ACTIVE_BUSINESS',
];

export function buildDeterministicOpportunityProfile(
  service: string,
  niche: string,
  category?: ProspectingCategory,
): OpportunityProfile {
  return {
    service: service.trim(),
    niche: niche.trim(),
    targetCustomer: [niche.trim()],
    relevantSignals: DEFAULT_SIGNALS,
    categories: category ? [category] : [],
  };
}

export function buildDeterministicSearchStrategy(profile: OpportunityProfile): OpportunitySearchStrategy {
  return {
    categories: profile.categories,
    minimumRating: null,
    minimumReviews: null,
    relevantSignals: profile.relevantSignals,
  };
}

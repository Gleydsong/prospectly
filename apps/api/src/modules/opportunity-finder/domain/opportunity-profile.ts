import {
  PROSPECTING_CATEGORY_VALUES,
  type OpportunityFinderSignalType,
  type OpportunityProfile,
  type OpportunitySearchStrategy,
  type ProspectingCategory,
} from '@prospectly/shared-types';
import { z } from 'zod';

const signalValues = [
  'MISSING_WEBSITE', 'LOW_PERFORMANCE', 'MISSING_HTTPS', 'MISSING_MOBILE_SUPPORT',
  'MISSING_BOOKING', 'MISSING_WHATSAPP', 'MISSING_CONTACT_FORM', 'HIGH_REVIEW_COUNT',
  'HIGH_RATING', 'CONTACT_AVAILABLE', 'ACTIVE_BUSINESS',
] as const satisfies readonly OpportunityFinderSignalType[];

export const OpportunityProfileSchema = z.object({
  service: z.string().trim().min(3).max(240),
  targetCustomer: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
  relevantSignals: z.array(z.enum(signalValues)).min(1).max(signalValues.length),
  categories: z.array(z.enum(PROSPECTING_CATEGORY_VALUES)).min(1).max(10),
});

export const OpportunitySearchStrategySchema = z.object({
  categories: z.array(z.enum(PROSPECTING_CATEGORY_VALUES)).min(1).max(10),
  minimumRating: z.number().min(0).max(5).nullable(),
  minimumReviews: z.number().int().min(0).max(100_000).nullable(),
  relevantSignals: z.array(z.enum(signalValues)).min(1).max(signalValues.length),
});

const DEFAULT_SIGNALS: OpportunityFinderSignalType[] = [
  'MISSING_WEBSITE', 'LOW_PERFORMANCE', 'MISSING_HTTPS', 'MISSING_MOBILE_SUPPORT',
  'MISSING_BOOKING', 'MISSING_WHATSAPP', 'MISSING_CONTACT_FORM', 'HIGH_REVIEW_COUNT',
  'HIGH_RATING', 'CONTACT_AVAILABLE', 'ACTIVE_BUSINESS',
];

const CATEGORY_HINTS: Array<{ pattern: RegExp; categories: ProspectingCategory[] }> = [
  { pattern: /hotel|pousada|hospedagem|turismo/i, categories: ['hotel', 'hostel', 'guest_house'] },
  { pattern: /sa[uú]de|cl[ií]nica|dent|m[eé]dic/i, categories: ['clinic', 'hospital', 'pharmacy'] },
  { pattern: /restaurante|delivery|alimenta|gastronom/i, categories: ['restaurant', 'cafe', 'bakery', 'bar'] },
  { pattern: /beleza|sal[aã]o|cabelo|est[eé]tica/i, categories: ['hairdresser', 'clothes'] },
  { pattern: /contab|jur[ií]dic|advoc/i, categories: ['accountant', 'lawyer'] },
];

const DEFAULT_CATEGORIES: ProspectingCategory[] = [
  'restaurant', 'cafe', 'bakery', 'hairdresser', 'clinic',
];

export function buildDeterministicOpportunityProfile(service: string): OpportunityProfile {
  const hinted = CATEGORY_HINTS.find((entry) => entry.pattern.test(service));
  return {
    service: service.trim(),
    targetCustomer: ['negócios locais brasileiros'],
    relevantSignals: DEFAULT_SIGNALS,
    categories: hinted?.categories ?? DEFAULT_CATEGORIES,
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

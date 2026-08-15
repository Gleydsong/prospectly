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
  niche: z.string().trim().min(2).max(120).optional(),
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

const CATEGORY_HINTS: ReadonlyArray<{ category: ProspectingCategory; pattern: RegExp }> = [
  { category: 'restaurant', pattern: /\b(restaurantes?|pizzarias?|lanchonetes?|churrascarias?)\b/ },
  { category: 'cafe', pattern: /\b(cafes?|cafeterias?)\b/ },
  { category: 'bar', pattern: /\b(bares?|pubs?)\b/ },
  { category: 'pharmacy', pattern: /\b(farmacias?|drogarias?)\b/ },
  { category: 'hospital', pattern: /\b(hospitais?|hospital)\b/ },
  { category: 'clinic', pattern: /\b(clinicas?|consultorios?|dentistas?|odontologia)\b/ },
  { category: 'supermarket', pattern: /\b(supermercados?|mercearias?)\b/ },
  { category: 'bakery', pattern: /\b(padarias?|panificadoras?|panificacao)\b/ },
  { category: 'butcher', pattern: /\b(acougues?|casas? de carnes?)\b/ },
  { category: 'clothes', pattern: /\b(roupas?|vestuarios?|moda|confeccao|confeccoes)\b/ },
  { category: 'hairdresser', pattern: /\b(cabeleireiros?|barbearias?|estetica|saloes? de beleza)\b/ },
  { category: 'carpenter', pattern: /\b(marcenarias?|marceneiros?)\b/ },
  { category: 'electrician', pattern: /\b(eletricistas?|instalacoes? eletricas?)\b/ },
  { category: 'accountant', pattern: /\b(contabilidades?|contadores?|escritorios? contabeis?)\b/ },
  { category: 'lawyer', pattern: /\b(advocacias?|advogados?|escritorios? juridicos?)\b/ },
  { category: 'hotel', pattern: /\b(hoteis?|hotel)\b/ },
  { category: 'hostel', pattern: /\b(hostels?|albergues?)\b/ },
  { category: 'guest_house', pattern: /\b(pousadas?|hospedarias?)\b/ },
];

export type OpportunityNicheResolution =
  | { status: 'RESOLVED'; category: ProspectingCategory }
  | { status: 'NOT_IDENTIFIED' }
  | { status: 'AMBIGUOUS'; categories: ProspectingCategory[] };

function normalizeNiche(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function resolveOpportunityNiche(niche: string): OpportunityNicheResolution {
  const normalized = normalizeNiche(niche);
  const categories = [...new Set(
    CATEGORY_HINTS
      .filter((hint) => hint.pattern.test(normalized))
      .map((hint) => hint.category),
  )];

  if (categories.length === 0) return { status: 'NOT_IDENTIFIED' };
  if (categories.length > 1) return { status: 'AMBIGUOUS', categories };
  return { status: 'RESOLVED', category: categories[0]! };
}

export function buildDeterministicOpportunityProfile(
  service: string,
  niche: string,
  category: ProspectingCategory,
): OpportunityProfile {
  return {
    service: service.trim(),
    niche: niche.trim(),
    targetCustomer: [niche.trim()],
    relevantSignals: DEFAULT_SIGNALS,
    categories: [category],
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

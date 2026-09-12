import type { NormalizedBusiness } from './normalized-business';

export const BRAZILIAN_STATE_CODES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type BrazilianStateCode = (typeof BRAZILIAN_STATE_CODES)[number];

/** Brazil-only prospecting (ISO 3166-1 alpha-2). */
export const PROSPECTING_COUNTRY_CODES = ['BR'] as const;

export type ProspectingCountryCode = (typeof PROSPECTING_COUNTRY_CODES)[number];

export const PROSPECTING_COUNTRIES = [
  { value: 'BR', label: 'Brasil' },
] as const satisfies readonly { value: ProspectingCountryCode; label: string }[];

const COUNTRY_LABEL_BY_CODE = Object.fromEntries(
  PROSPECTING_COUNTRIES.map((country) => [country.value, country.label]),
) as Record<ProspectingCountryCode, string>;

export function isProspectingCountryCode(value: unknown): value is ProspectingCountryCode {
  return typeof value === 'string' && (PROSPECTING_COUNTRY_CODES as readonly string[]).includes(value);
}

export function isBrazilianStateCode(value: string): value is BrazilianStateCode {
  return (BRAZILIAN_STATE_CODES as readonly string[]).includes(value);
}

export function countryDisplayName(country: ProspectingCountryCode): string {
  return COUNTRY_LABEL_BY_CODE[country] ?? country;
}

export const PROSPECTING_PROVIDER_IDS = ['OPENSTREETMAP', 'GOOGLE_PLACES'] as const;
export type ProspectingProviderId = (typeof PROSPECTING_PROVIDER_IDS)[number];

/** Persisted when a search fan-outs to every available map provider. */
export const COMBINED_SEARCH_PROVIDER = 'COMBINED';

export interface SearchProviderInput {
  category?: string;
  categories?: string[];
  /** Optional free-text Places queries. When set, Google uses these instead of category labels. */
  textQueries?: string[];
  city: string;
  /** Optional neighborhood/district used to narrow the search inside the city. */
  neighborhood?: string;
  state: string;
  country: ProspectingCountryCode;
  onlyWithoutWebsite: boolean;
  /** Upper bound of results the caller wants; providers may return fewer. */
  limit?: number;
}

export function formatLocalizedPlaceQuery(
  phrase: string,
  city: string,
  region: string,
  country: ProspectingCountryCode,
  neighborhood?: string,
): string {
  const countryName = countryDisplayName(country);
  const place = [neighborhood?.trim(), city.trim(), region.trim(), countryName]
    .filter((part): part is string => Boolean(part))
    .join(', ');
  const preposition = country === 'BR' || country === 'PT' ? 'em' : 'in';
  return `${phrase.trim()} ${preposition} ${place}`;
}

export interface SearchProvider {
  search(input: SearchProviderInput): Promise<NormalizedBusiness[]>;
}

export interface SearchProviderInfo {
  id: ProspectingProviderId;
  label: string;
  available: boolean;
}

export interface SearchProviderRegistry {
  list(): SearchProviderInfo[];
  isAvailable(id: ProspectingProviderId): boolean;
  resolve(id: ProspectingProviderId): SearchProvider;
}

export const OPENSTREETMAP_SEARCH_PROVIDER = 'OPENSTREETMAP_SEARCH_PROVIDER';
export const GOOGLE_PLACES_SEARCH_PROVIDER = 'GOOGLE_PLACES_SEARCH_PROVIDER';
export const SEARCH_PROVIDER_REGISTRY = 'SEARCH_PROVIDER_REGISTRY';

export function isProspectingProviderId(value: unknown): value is ProspectingProviderId {
  return typeof value === 'string' && (PROSPECTING_PROVIDER_IDS as readonly string[]).includes(value);
}

export function isStoredSearchProvider(
  value: unknown,
): value is ProspectingProviderId | typeof COMBINED_SEARCH_PROVIDER {
  return isProspectingProviderId(value) || value === COMBINED_SEARCH_PROVIDER;
}

export class InMemorySearchProviderRegistry implements SearchProviderRegistry {
  private readonly entries: Array<{
    id: ProspectingProviderId;
    label: string;
    provider: SearchProvider | null;
  }>;

  constructor(
    entries: Array<{ id: ProspectingProviderId; label: string; provider: SearchProvider | null }>,
  ) {
    this.entries = entries;
  }

  list(): SearchProviderInfo[] {
    return this.entries.map(({ id, label, provider }) => ({
      id,
      label,
      available: provider !== null,
    }));
  }

  isAvailable(id: ProspectingProviderId): boolean {
    return this.entries.some((entry) => entry.id === id && entry.provider !== null);
  }

  resolve(id: ProspectingProviderId): SearchProvider {
    const entry = this.entries.find((item) => item.id === id);
    if (!entry?.provider) {
      throw new Error(`Search provider unavailable: ${id}`);
    }
    return entry.provider;
  }
}

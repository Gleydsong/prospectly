import type { NormalizedBusiness } from './normalized-business';

export const BRAZILIAN_STATE_CODES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type BrazilianStateCode = (typeof BRAZILIAN_STATE_CODES)[number];

/** Brazil + broad European ISO 3166-1 alpha-2 list for prospecting search. */
export const PROSPECTING_COUNTRY_CODES = [
  'BR',
  'AD', 'AL', 'AT', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES',
  'FI', 'FR', 'GB', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC',
  'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SK',
  'SM', 'UA', 'VA', 'XK',
] as const;

export type ProspectingCountryCode = (typeof PROSPECTING_COUNTRY_CODES)[number];

export const PROSPECTING_COUNTRIES = [
  { value: 'BR', label: 'Brasil' },
  { value: 'AD', label: 'Andorra' },
  { value: 'AL', label: 'Albânia' },
  { value: 'AT', label: 'Áustria' },
  { value: 'BA', label: 'Bósnia e Herzegovina' },
  { value: 'BE', label: 'Bélgica' },
  { value: 'BG', label: 'Bulgária' },
  { value: 'BY', label: 'Bielorrússia' },
  { value: 'CH', label: 'Suíça' },
  { value: 'CY', label: 'Chipre' },
  { value: 'CZ', label: 'Chéquia' },
  { value: 'DE', label: 'Alemanha' },
  { value: 'DK', label: 'Dinamarca' },
  { value: 'EE', label: 'Estónia' },
  { value: 'ES', label: 'Espanha' },
  { value: 'FI', label: 'Finlândia' },
  { value: 'FR', label: 'França' },
  { value: 'GB', label: 'Reino Unido' },
  { value: 'GR', label: 'Grécia' },
  { value: 'HR', label: 'Croácia' },
  { value: 'HU', label: 'Hungria' },
  { value: 'IE', label: 'Irlanda' },
  { value: 'IS', label: 'Islândia' },
  { value: 'IT', label: 'Itália' },
  { value: 'LI', label: 'Listenstaine' },
  { value: 'LT', label: 'Lituânia' },
  { value: 'LU', label: 'Luxemburgo' },
  { value: 'LV', label: 'Letónia' },
  { value: 'MC', label: 'Mónaco' },
  { value: 'MD', label: 'Moldávia' },
  { value: 'ME', label: 'Montenegro' },
  { value: 'MK', label: 'Macedónia do Norte' },
  { value: 'MT', label: 'Malta' },
  { value: 'NL', label: 'Países Baixos' },
  { value: 'NO', label: 'Noruega' },
  { value: 'PL', label: 'Polónia' },
  { value: 'PT', label: 'Portugal' },
  { value: 'RO', label: 'Roménia' },
  { value: 'RS', label: 'Sérvia' },
  { value: 'RU', label: 'Rússia' },
  { value: 'SE', label: 'Suécia' },
  { value: 'SI', label: 'Eslovénia' },
  { value: 'SK', label: 'Eslováquia' },
  { value: 'SM', label: 'San Marino' },
  { value: 'UA', label: 'Ucrânia' },
  { value: 'VA', label: 'Vaticano' },
  { value: 'XK', label: 'Kosovo' },
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
  category: string;
  categories?: string[];
  city: string;
  /** Optional neighborhood/district used to narrow the search inside the city. */
  neighborhood?: string;
  state: string;
  country: ProspectingCountryCode;
  onlyWithoutWebsite: boolean;
  /** Upper bound of results the caller wants; providers may return fewer. */
  limit?: number;
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

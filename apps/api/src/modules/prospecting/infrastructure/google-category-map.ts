import { PROSPECTING_CATEGORIES, type ProspectingCategory } from '@prospectly/shared-types';

import {
  countryDisplayName,
  type ProspectingCountryCode,
} from '../domain/search-provider';

const LABEL_BY_VALUE = Object.fromEntries(
  PROSPECTING_CATEGORIES.map((category) => [category.value, category.label]),
) as Record<ProspectingCategory, string>;

const LANGUAGE_BY_COUNTRY: Partial<Record<ProspectingCountryCode, string>> = {
  BR: 'pt-BR',
  PT: 'pt-PT',
  ES: 'es',
  FR: 'fr',
  DE: 'de',
  IT: 'it',
  NL: 'nl',
  PL: 'pl',
  RO: 'ro',
  SE: 'sv',
  NO: 'no',
  DK: 'da',
  FI: 'fi',
  GR: 'el',
  HU: 'hu',
  CZ: 'cs',
  SK: 'sk',
  HR: 'hr',
  UA: 'uk',
  RU: 'ru',
};

export function googleLanguageCode(country: ProspectingCountryCode): string {
  return LANGUAGE_BY_COUNTRY[country] ?? 'en';
}

export function mapCategoryToGoogleTextQuery(
  category: string,
  city: string,
  region: string,
  country: ProspectingCountryCode,
): string {
  const normalized = category.trim().toLocaleLowerCase('pt-BR') as ProspectingCategory;
  const label = LABEL_BY_VALUE[normalized] ?? category.trim();
  const countryName = countryDisplayName(country);
  if (country === 'BR' || country === 'PT') {
    return `${label} em ${city.trim()}, ${region.trim()}, ${countryName}`;
  }
  return `${label} in ${city.trim()}, ${region.trim()}, ${countryName}`;
}

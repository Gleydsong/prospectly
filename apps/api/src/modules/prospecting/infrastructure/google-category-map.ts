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
};

/** Places Table A / common types → Prospectly taxonomy. */
const GOOGLE_TYPE_TO_CATEGORY: Record<string, ProspectingCategory> = {
  restaurant: 'restaurant',
  meal_takeaway: 'restaurant',
  meal_delivery: 'restaurant',
  cafe: 'cafe',
  coffee_shop: 'cafe',
  bakery: 'bakery',
  bar: 'bar',
  pub: 'bar',
  pharmacy: 'pharmacy',
  drugstore: 'pharmacy',
  hospital: 'hospital',
  doctor: 'clinic',
  dentist: 'clinic',
  medical_clinic: 'clinic',
  supermarket: 'supermarket',
  grocery_store: 'supermarket',
  butcher_shop: 'butcher',
  clothing_store: 'clothes',
  hair_salon: 'hairdresser',
  hair_care: 'hairdresser',
  beauty_salon: 'hairdresser',
  barber_shop: 'hairdresser',
  carpenter: 'carpenter',
  electrician: 'electrician',
  accounting: 'accountant',
  lawyer: 'lawyer',
  attorney: 'lawyer',
  hotel: 'hotel',
  lodging: 'hotel',
  hostel: 'hostel',
  guest_house: 'guest_house',
  bed_and_breakfast: 'guest_house',
};

export function googleLanguageCode(country: ProspectingCountryCode): string {
  return LANGUAGE_BY_COUNTRY[country] ?? 'en';
}

export function mapGooglePlaceTypeToCategory(type: string): ProspectingCategory | undefined {
  return GOOGLE_TYPE_TO_CATEGORY[type.trim().toLowerCase()];
}

export function resolveGooglePlaceCategory(
  place: { primaryType?: string; types?: string[] },
  searchedCategory: string,
): string {
  const candidates = [place.primaryType, ...(place.types ?? [])].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  for (const type of candidates) {
    const mapped = mapGooglePlaceTypeToCategory(type);
    if (mapped) return mapped;
  }
  return searchedCategory;
}

export function mapCategoryToGoogleTextQuery(
  category: string,
  city: string,
  region: string,
  country: ProspectingCountryCode,
  neighborhood?: string,
): string {
  const normalized = category.trim().toLocaleLowerCase('pt-BR') as ProspectingCategory;
  const label = LABEL_BY_VALUE[normalized] ?? category.trim();
  const countryName = countryDisplayName(country);
  const place = [neighborhood?.trim(), city.trim(), region.trim(), countryName]
    .filter((part): part is string => Boolean(part))
    .join(', ');
  const preposition = country === 'BR' || country === 'PT' ? 'em' : 'in';
  return `${label} ${preposition} ${place}`;
}

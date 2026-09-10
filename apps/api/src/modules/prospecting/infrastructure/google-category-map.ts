import { PROSPECTING_CATEGORIES, type ProspectingCategory } from '@prospectly/shared-types';

import {
  formatLocalizedPlaceQuery,
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
  pizza_restaurant: 'restaurant',
  steak_house: 'restaurant',
  brazilian_restaurant: 'restaurant',
  fast_food_restaurant: 'restaurant',
  hamburger_restaurant: 'restaurant',
  ice_cream_shop: 'cafe',
  tea_house: 'cafe',
  doctor: 'clinic',
  dentist: 'clinic',
  dental_clinic: 'clinic',
  medical_clinic: 'clinic',
  physiotherapist: 'clinic',
  medical_lab: 'clinic',
  supermarket: 'supermarket',
  grocery_store: 'supermarket',
  grocery_or_supermarket: 'supermarket',
  butcher_shop: 'butcher',
  clothing_store: 'clothes',
  shoe_store: 'clothes',
  hair_salon: 'hairdresser',
  hair_care: 'hairdresser',
  beauty_salon: 'hairdresser',
  barber_shop: 'hairdresser',
  nail_salon: 'hairdresser',
  spa: 'hairdresser',
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
  return formatLocalizedPlaceQuery(label, city, region, country, neighborhood);
}

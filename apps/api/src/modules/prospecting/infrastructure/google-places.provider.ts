import { WebsitePresence } from '@prisma/client';

import type { NormalizedBusiness } from '../domain/normalized-business';
import {
  toGoogleLocationRestriction,
  type GeographicBoundingBox,
} from '../domain/geographic-bounding-box';
import { SearchProviderError } from '../domain/search-provider-error';
import {
  isBrazilianStateCode,
  isProspectingCountryCode,
  type ProspectingCountryCode,
  type SearchProvider,
  type SearchProviderInput,
} from '../domain/search-provider';
import {
  googleLanguageCode,
  mapCategoryToGoogleTextQuery,
  resolveGooglePlaceCategory,
} from './google-category-map';
import type { BoundingBoxResolver } from './nominatim-bounding-box.resolver';

/** Places API (New) text search caps a single response at 20 places. */
const GOOGLE_MAX_RESULTS_PER_REQUEST = 20;
const GOOGLE_MAX_TEXT_QUERIES = 4;

function resolveGoogleTextQueries(
  input: SearchProviderInput,
  categories: string[],
  region: string,
  country: ProspectingCountryCode,
): Array<{ textQuery: string; fallbackCategory: string }> {
  const custom = [...new Set(
    (input.textQueries ?? []).map((query) => query.trim()).filter(Boolean),
  )].slice(0, GOOGLE_MAX_TEXT_QUERIES);
  if (custom.length > 0) {
    const fallbackCategory = input.category.trim() || categories[0]!;
    return custom.map((textQuery) => ({ textQuery, fallbackCategory }));
  }
  return categories.map((category) => ({
    textQuery: mapCategoryToGoogleTextQuery(
      category,
      input.city,
      region,
      country,
      input.neighborhood,
    ),
    fallbackCategory: category,
  }));
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.addressComponents',
  'places.primaryType',
  'places.types',
].join(',');

export interface GooglePlacesProviderOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs: number;
  resultLimit: number;
  fetch?: typeof fetch;
  boundingBoxResolver?: BoundingBoxResolver;
}

interface GooglePlacesTextSearchResponse {
  places?: GooglePlace[];
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  types?: string[];
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
}

interface GoogleErrorBody {
  error?: {
    status?: string;
    message?: string;
    details?: Array<{ reason?: string }>;
  };
}

function component(
  place: GooglePlace,
  type: string,
): { longText?: string; shortText?: string } | undefined {
  return place.addressComponents?.find((entry) => entry.types?.includes(type));
}

function normalizeLocationText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function locationTextEquals(left: string, right: string): boolean {
  return normalizeLocationText(left) === normalizeLocationText(right);
}

function locationTextContainsToken(haystack: string, needle: string): boolean {
  const token = normalizeLocationText(needle);
  if (token.length < 3) return false;
  return ` ${normalizeLocationText(haystack)} `.includes(` ${token} `);
}

/** Drop Google ranking spillover (e.g. Manaus results for a search in Anamã). */
function placeBelongsToRequestedCity(place: GooglePlace, requestedCity: string): boolean {
  const locality = component(place, 'locality')?.longText?.trim();
  const admin2 = component(place, 'administrative_area_level_2')?.longText?.trim();
  if (locality && locationTextEquals(locality, requestedCity)) return true;
  if (admin2 && locationTextEquals(admin2, requestedCity)) return true;
  if (locality && !locationTextEquals(locality, requestedCity)) return false;

  const address = place.formattedAddress?.trim();
  if (address && locationTextContainsToken(address, requestedCity)) return true;
  if (!locality && !admin2 && !address) return true;
  return false;
}

function normalizePlace(
  place: GooglePlace,
  fallbackCity: string,
  fallbackRegion: string,
  country: ProspectingCountryCode,
): NormalizedBusiness | null {
  const companyName = place.displayName?.text?.trim();
  const externalId = place.id?.trim();
  if (!companyName || !externalId) return null;

  const city =
    component(place, 'locality')?.longText?.trim() ||
    component(place, 'administrative_area_level_2')?.longText?.trim() ||
    fallbackCity;
  const adminShort = component(place, 'administrative_area_level_1')?.shortText?.trim();
  const adminLong = component(place, 'administrative_area_level_1')?.longText?.trim();
  let region = adminShort || adminLong || fallbackRegion;
  if (country === 'BR') {
    const candidate = (adminShort ?? fallbackRegion).toUpperCase();
    if (!isBrazilianStateCode(candidate)) {
      region = fallbackRegion;
    } else {
      region = candidate;
    }
  }

  const website = place.websiteUri?.trim() || undefined;
  const phone =
    place.internationalPhoneNumber?.trim() || place.nationalPhoneNumber?.trim() || undefined;

  return {
    externalId: `places/${externalId}`,
    companyName,
    phone,
    website,
    address: place.formattedAddress?.trim() || undefined,
    city,
    state: region,
    country,
    postalCode: component(place, 'postal_code')?.longText?.trim() || undefined,
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    source: 'GOOGLE_PLACES',
    websitePresence: website ? WebsitePresence.WEBSITE_FOUND : WebsitePresence.NO_WEBSITE_REPORTED,
  };
}

function publicMessageForGoogleFailure(statusCode: number, reason?: string): string {
  if (reason === 'SERVICE_DISABLED' || statusCode === 403) {
    return 'Google Places API (New) is disabled or the API key lacks permission (PERMISSION_DENIED). Enable places.googleapis.com in Google Cloud.';
  }
  if (statusCode === 400 || reason === 'INVALID_ARGUMENT') {
    return 'Google Places rejected the search request (INVALID_ARGUMENT).';
  }
  if (statusCode === 429 || reason === 'RESOURCE_EXHAUSTED') {
    return 'Google Places rate limit reached. Please try again later.';
  }
  return 'Search provider is temporarily unavailable. Please try again later.';
}

async function readGoogleErrorMeta(
  response: Response,
): Promise<{ reason?: string; status?: string }> {
  try {
    const body = (await response.json()) as GoogleErrorBody;
    const reason =
      body.error?.details?.find((detail) => typeof detail.reason === 'string')?.reason ??
      body.error?.status;
    return { reason, status: body.error?.status };
  } catch {
    return {};
  }
}

export class GooglePlacesProvider implements SearchProvider {
  private readonly fetchImplementation: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly options: GooglePlacesProviderOptions) {
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    this.baseUrl = (options.baseUrl ?? 'https://places.googleapis.com/v1').replace(/\/$/, '');
    if (!this.fetchImplementation) throw new Error('Fetch API is unavailable');
    if (!options.apiKey.trim()) throw new Error('GOOGLE_PLACES_API_KEY is required');
  }

  async search(input: SearchProviderInput): Promise<NormalizedBusiness[]> {
    if (!isProspectingCountryCode(input.country)) {
      throw new Error(`Unsupported country: ${input.country}`);
    }
    if (!input.city.trim()) throw new Error('City is required');
    if (!input.state.trim()) throw new Error('Region is required');

    const country = input.country;
    const region =
      country === 'BR' ? input.state.trim().toUpperCase() : input.state.trim();
    if (country === 'BR' && !isBrazilianStateCode(region)) {
      throw new Error(`Invalid Brazilian state: ${region}`);
    }

    const categories = [
      ...new Set(
        (input.categories?.length ? input.categories : [input.category])
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    if (categories.length === 0) throw new Error('Category is required');

    const requestedLimit = input.limit && input.limit > 0 ? input.limit : this.options.resultLimit;
    const perCategoryLimit = Math.min(
      GOOGLE_MAX_RESULTS_PER_REQUEST,
      Math.max(1, Math.min(this.options.resultLimit, requestedLimit)),
    );

    const locationRestriction = await this.resolveLocationRestriction(input, region, country);
    const queries = resolveGoogleTextQueries(input, categories, region, country);

    const categoryBatches = await Promise.all(
      queries.map(async ({ textQuery, fallbackCategory }) => {
        const response = await this.requestTextSearch({
          textQuery,
          languageCode: googleLanguageCode(country),
          regionCode: country,
          maxResultCount: perCategoryLimit,
          ...(locationRestriction ? { locationRestriction } : {}),
        });

        const businesses: NormalizedBusiness[] = [];
        for (const place of response.places ?? []) {
          if (!placeBelongsToRequestedCity(place, input.city)) continue;
          const business = normalizePlace(place, input.city.trim(), region, country);
          if (!business) continue;
          if (
            input.onlyWithoutWebsite &&
            business.websitePresence !== WebsitePresence.NO_WEBSITE_REPORTED
          ) {
            continue;
          }
          businesses.push({
            ...business,
            category: resolveGooglePlaceCategory(place, fallbackCategory),
          });
        }
        return businesses;
      }),
    );

    const merged = new Map<string, NormalizedBusiness>();
    for (const business of categoryBatches.flat()) {
      if (merged.has(business.externalId)) continue;
      merged.set(business.externalId, business);
    }

    return [...merged.values()];
  }

  private async resolveLocationRestriction(
    input: SearchProviderInput,
    region: string,
    country: ProspectingCountryCode,
  ) {
    const resolver = this.options.boundingBoxResolver;
    if (!resolver) return undefined;
    try {
      const box: GeographicBoundingBox | undefined = await resolver.resolve({
        city: input.city.trim(),
        region,
        country,
        neighborhood: input.neighborhood?.trim() || undefined,
      });
      return box ? toGoogleLocationRestriction(box) : undefined;
    } catch {
      return undefined;
    }
  }

  private async requestTextSearch(body: Record<string, unknown>): Promise<GooglePlacesTextSearchResponse> {
    const maxAttempts = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
      try {
        const response = await this.fetchImplementation(`${this.baseUrl}/places:searchText`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.options.apiKey,
            'X-Goog-FieldMask': FIELD_MASK,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const meta = await readGoogleErrorMeta(response);
          const retryable = response.status === 429 || response.status >= 500;
          throw new SearchProviderError({
            provider: 'GOOGLE_PLACES',
            message: 'Google Places provider request failed',
            publicMessage: publicMessageForGoogleFailure(response.status, meta.reason ?? meta.status),
            retryable,
            statusCode: response.status,
            reason: meta.reason ?? meta.status,
          });
        }

        return (await response.json()) as GooglePlacesTextSearchResponse;
      } catch (error) {
        lastError = error;
        if (error instanceof SearchProviderError && !error.retryable) {
          throw error;
        }
        const retryable =
          error instanceof SearchProviderError
            ? error.retryable
            : error instanceof Error && error.name === 'AbortError';
        if (!retryable || attempt === maxAttempts) {
          if (error instanceof SearchProviderError) throw error;
          throw new SearchProviderError({
            provider: 'GOOGLE_PLACES',
            message: 'Google Places provider request failed',
            publicMessage: 'Search provider is temporarily unavailable. Please try again later.',
            retryable: false,
            reason: error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'UPSTREAM_ERROR',
          });
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new SearchProviderError({
          provider: 'GOOGLE_PLACES',
          message: 'Google Places provider request failed',
          publicMessage: 'Search provider is temporarily unavailable. Please try again later.',
          retryable: false,
        });
  }
}

import { WebsitePresence } from '@prisma/client';

import type { NormalizedBusiness } from '../domain/normalized-business';
import { SearchProviderError } from '../domain/search-provider-error';
import {
  isBrazilianStateCode,
  isProspectingCountryCode,
  type ProspectingCountryCode,
  type SearchProvider,
  type SearchProviderInput,
} from '../domain/search-provider';
import { googleLanguageCode, mapCategoryToGoogleTextQuery } from './google-category-map';

/** Places API (New) text search caps a single response at 20 places. */
const GOOGLE_MAX_RESULTS_PER_REQUEST = 20;

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.location',
  'places.addressComponents',
].join(',');

export interface GooglePlacesProviderOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs: number;
  resultLimit: number;
  fetch?: typeof fetch;
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

    const categoryBatches = await Promise.all(
      categories.map(async (category) => {
        const response = await this.requestTextSearch({
          textQuery: mapCategoryToGoogleTextQuery(
            category,
            input.city,
            region,
            country,
            input.neighborhood,
          ),
          languageCode: googleLanguageCode(country),
          regionCode: country,
          maxResultCount: perCategoryLimit,
        });

        const businesses: NormalizedBusiness[] = [];
        for (const place of response.places ?? []) {
          const business = normalizePlace(place, input.city.trim(), region, country);
          if (!business) continue;
          if (
            input.onlyWithoutWebsite &&
            business.websitePresence !== WebsitePresence.NO_WEBSITE_REPORTED
          ) {
            continue;
          }
          businesses.push({ ...business, category });
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

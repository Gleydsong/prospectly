import { WebsitePresence } from '@prisma/client';

import {
  BRAZILIAN_STATE_CODES,
  countryDisplayName,
  isProspectingCountryCode,
  type BrazilianStateCode,
  type ProspectingCountryCode,
  type SearchProvider,
  type SearchProviderInput,
} from '../domain/search-provider';
import { SearchProviderError } from '../domain/search-provider-error';
import type { NormalizedBusiness } from '../domain/normalized-business';
import { mapCategoryToOsmTags, type OsmTagMap } from './osm-category-map';
import type { NominatimRateLimiter } from './nominatim-rate-limiter';

const DEFAULT_OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
] as const;

const MAX_BBOX_SPAN_DEGREES = 0.75;

interface NominatimPlace {
  osm_id?: number;
  osm_type?: string;
  display_name?: string;
  address?: Record<string, unknown>;
  extratags?: Record<string, string>;
  boundingbox?: string[];
}

interface BoundingBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

interface NominatimMunicipality extends NominatimPlace {
  osm_id: number;
  osm_type: 'relation';
  boundingBox?: BoundingBox;
}

interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface MunicipalityCacheEntry {
  municipality: Promise<NominatimMunicipality | undefined>;
  expiresAt: number;
}

class ProviderRequestError extends Error {
  constructor(
    readonly retryable: boolean,
    readonly reason: string,
    readonly statusCode?: number,
    readonly retryAfterMs?: number,
  ) {
    super('OpenStreetMap provider request failed');
    this.name = 'ProviderRequestError';
  }
}

export interface OpenStreetMapProviderOptions {
  nominatimUrl: string;
  overpassUrl: string;
  overpassUrls?: string[];
  userAgent: string;
  timeoutMs: number;
  resultLimit: number;
  municipalityCacheTtlMs?: number;
  municipalityCacheMaxEntries?: number;
  rateLimiter?: NominatimRateLimiter;
  fetch?: typeof fetch;
}

const STATE_NAMES: Readonly<Record<BrazilianStateCode, string>> = {
  AC: 'acre', AL: 'alagoas', AP: 'amapa', AM: 'amazonas', BA: 'bahia', CE: 'ceara',
  DF: 'distrito federal', ES: 'espirito santo', GO: 'goias', MA: 'maranhao',
  MT: 'mato grosso', MS: 'mato grosso do sul', MG: 'minas gerais', PA: 'para',
  PB: 'paraiba', PR: 'parana', PE: 'pernambuco', PI: 'piaui', RJ: 'rio de janeiro',
  RN: 'rio grande do norte', RS: 'rio grande do sul', RO: 'rondonia', RR: 'roraima',
  SC: 'santa catarina', SP: 'sao paulo', SE: 'sergipe', TO: 'tocantins',
};

function normalizeText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isBrazilianStateCodeValue(value: string): value is BrazilianStateCode {
  return (BRAZILIAN_STATE_CODES as readonly string[]).includes(value);
}

function escapeOverpassValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function hasRequestedRegion(
  place: NominatimPlace,
  region: string,
  country: ProspectingCountryCode,
): boolean {
  const address = place.address ?? {};
  const normalizedRegion = normalizeText(region);

  if (country === 'BR' && isBrazilianStateCodeValue(region.toUpperCase())) {
    const state = region.toUpperCase() as BrazilianStateCode;
    const isoState = address['ISO3166-2-lvl4'] ?? address.ISO3166_2_lvl4;
    if (typeof isoState === 'string' && isoState.toUpperCase() === `BR-${state}`) {
      return true;
    }
    const placeState = address.state;
    return typeof placeState === 'string' && normalizeText(placeState) === STATE_NAMES[state];
  }

  const isoState = address['ISO3166-2-lvl4'] ?? address.ISO3166_2_lvl4;
  if (typeof isoState === 'string') {
    const suffix = isoState.includes('-') ? isoState.split('-').slice(1).join('-') : isoState;
    if (normalizeText(suffix) === normalizedRegion || normalizeText(isoState) === normalizedRegion) {
      return true;
    }
  }

  const candidates = [address.state, address.county, address.region, address.province, address.state_district];
  return candidates.some(
    (value) => typeof value === 'string' && normalizeText(value) === normalizedRegion,
  );
}

function hasRequestedCity(place: NominatimPlace, city: string): boolean {
  const address = place.address ?? {};
  const municipality = [
    address.city,
    address.town,
    address.municipality,
    address.village,
    place.display_name?.split(',')[0],
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return typeof municipality === 'string' && normalizeText(municipality) === normalizeText(city);
}

function matchesCountry(place: NominatimPlace, country: ProspectingCountryCode): boolean {
  const code = place.address?.country_code;
  return typeof code !== 'string' || code.toLowerCase() === country.toLowerCase();
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function getRetryAfterMs(response: Response): number | undefined {
  const retryAfter = response.headers.get('retry-after')?.trim();
  if (!retryAfter) return undefined;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const date = Date.parse(retryAfter);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function parseBoundingBox(raw: string[] | undefined): BoundingBox | undefined {
  if (!raw || raw.length < 4) return undefined;
  const south = Number(raw[0]);
  const north = Number(raw[1]);
  const west = Number(raw[2]);
  const east = Number(raw[3]);
  if (![south, north, west, east].every((value) => Number.isFinite(value))) return undefined;
  return { south, north, west, east };
}

function getAdminLevel(place: NominatimPlace): number | undefined {
  const raw = place.extratags?.admin_level;
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function isMunicipalityRelation(place: NominatimPlace): boolean {
  const adminLevel = getAdminLevel(place);
  if (adminLevel === 4) return false;
  if (adminLevel !== undefined && adminLevel >= 7 && adminLevel <= 10) return true;
  const placeTag = place.extratags?.place;
  return placeTag === 'city' || placeTag === 'municipality' || placeTag === 'town';
}

function overpassServerTimeoutSec(timeoutMs: number): number {
  return Math.max(1, Math.ceil(timeoutMs / 1000) - 5);
}

function isCompactBoundingBox(boundingBox: BoundingBox): boolean {
  const latSpan = Math.abs(boundingBox.north - boundingBox.south);
  const lonSpan = Math.abs(boundingBox.east - boundingBox.west);
  return latSpan <= MAX_BBOX_SPAN_DEGREES && lonSpan <= MAX_BBOX_SPAN_DEGREES;
}

function resolveSearchCategories(input: SearchProviderInput): string[] {
  const raw = input.categories?.length ? input.categories : [input.category];
  const categories = [...new Set(raw.map((value) => value.trim()).filter(Boolean))];
  if (categories.length === 0) {
    throw new Error('Category is required');
  }
  return categories;
}

function mergeOsmTagMaps(maps: OsmTagMap[]): OsmTagMap {
  const merged: {
    -readonly [K in keyof OsmTagMap]: string[];
  } = {};

  for (const map of maps) {
    for (const [key, values] of Object.entries(map) as Array<
      [keyof OsmTagMap, readonly string[] | undefined]
    >) {
      if (!values?.length) continue;
      const bucket = merged[key] ?? (merged[key] = []);
      for (const value of values) {
        if (!bucket.includes(value)) bucket.push(value);
      }
    }
  }

  return merged;
}

function buildTagSelectors(tags: OsmTagMap, scope: string): string {
  return Object.entries(tags)
    .flatMap(([key, values]) =>
      (values ?? []).flatMap((value) => {
        const filter = `["${escapeOverpassValue(key)}"="${escapeOverpassValue(value)}"]`;
        return [`node${filter}${scope};`, `way${filter}${scope};`];
      }),
    )
    .join('\n');
}

function buildOverpassQuery(
  areaId: number,
  tags: OsmTagMap,
  resultLimit: number,
  timeoutMs: number,
  boundingBox?: BoundingBox,
): string {
  const timeoutSec = overpassServerTimeoutSec(timeoutMs);

  if (boundingBox && isCompactBoundingBox(boundingBox)) {
    const scope = `(${boundingBox.south},${boundingBox.west},${boundingBox.north},${boundingBox.east})`;
    return `[out:json][timeout:${timeoutSec}];\n(\n${buildTagSelectors(tags, scope)}\n);\nout center tags ${resultLimit};`;
  }

  return `[out:json][timeout:${timeoutSec}];\narea(${areaId})->.searchArea;\n(\n${buildTagSelectors(tags, '(area.searchArea)')}\n);\nout center tags ${resultLimit};`;
}

function toSearchProviderError(error: ProviderRequestError): SearchProviderError {
  return new SearchProviderError({
    provider: 'OPENSTREETMAP',
    message: 'OpenStreetMap provider request failed',
    publicMessage: 'Search provider is temporarily unavailable. Please try again later.',
    retryable: error.retryable,
    statusCode: error.statusCode,
    reason: error.reason,
  });
}

function getWebsite(tags: Record<string, string>): string | undefined {
  return tags.website?.trim() || tags['contact:website']?.trim() || tags.url?.trim() || undefined;
}

function getAddress(tags: Record<string, string>): string | undefined {
  const street = tags['addr:street']?.trim();
  const number = tags['addr:housenumber']?.trim();
  if (street && number) return `${street}, ${number}`;
  return street || number || tags['addr:full']?.trim() || undefined;
}

function normalizeElement(
  element: OverpassElement,
  city: string,
  state: string,
  country: ProspectingCountryCode,
): NormalizedBusiness | undefined {
  const tags = element.tags;
  const name = tags?.name?.trim();
  if (!element.type || typeof element.id !== 'number' || !tags || !name) return undefined;

  const website = getWebsite(tags);
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  const category = ['amenity', 'shop', 'craft', 'office', 'tourism']
    .map((key) => tags[key])
    .find((value): value is string => Boolean(value));

  return {
    externalId: `${element.type}/${element.id}`,
    companyName: name,
    category,
    phone: tags.phone?.trim() || tags['contact:phone']?.trim() || undefined,
    email: tags.email?.trim() || tags['contact:email']?.trim() || undefined,
    website,
    address: getAddress(tags),
    city,
    state,
    country,
    postalCode: tags['addr:postcode']?.trim() || undefined,
    latitude,
    longitude,
    source: 'OPENSTREETMAP',
    websitePresence: website ? WebsitePresence.WEBSITE_FOUND : WebsitePresence.NO_WEBSITE_REPORTED,
  };
}

export class OpenStreetMapProvider implements SearchProvider {
  private readonly fetchImplementation: typeof fetch;
  private readonly municipalityCache = new Map<string, MunicipalityCacheEntry>();
  private readonly rateLimiter: NominatimRateLimiter;

  constructor(private readonly options: OpenStreetMapProviderOptions) {
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    this.rateLimiter = options.rateLimiter ?? { waitForTurn: async () => undefined };
    if (!this.fetchImplementation) throw new Error('Fetch API is unavailable');
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
    if (country === 'BR' && !isBrazilianStateCodeValue(region)) {
      throw new Error(`Invalid Brazilian state: ${region}`);
    }

    const categories = resolveSearchCategories(input);
    const categoryTags = mergeOsmTagMaps(categories.map((category) => mapCategoryToOsmTags(category)));
    const municipality = await this.findMunicipality(input.city.trim(), region, country);
    if (!municipality) return [];

    const overpassResponse = await this.requestOverpass(
      buildOverpassQuery(
        3600000000 + municipality.osm_id,
        categoryTags,
        this.options.resultLimit,
        this.options.timeoutMs,
        municipality.boundingBox,
      ),
    );

    return (overpassResponse.elements ?? [])
      .map((element) => normalizeElement(element, input.city.trim(), region, country))
      .filter((business): business is NormalizedBusiness => Boolean(business))
      .filter((business) => !input.onlyWithoutWebsite || business.websitePresence === WebsitePresence.NO_WEBSITE_REPORTED);
  }

  private resolveOverpassUrls(): string[] {
    const primary = this.options.overpassUrl.trim();
    const extras =
      this.options.overpassUrls ??
      (/overpass-api\.de|overpass\.kumi\.systems/i.test(primary)
        ? [...DEFAULT_OVERPASS_MIRRORS]
        : []);
    return [...new Set([primary, ...extras].map((url) => url.trim()).filter(Boolean))];
  }

  private async requestOverpass(body: string): Promise<OverpassResponse> {
    const urls = this.resolveOverpassUrls();
    let lastError: SearchProviderError | undefined;

    for (const url of urls) {
      try {
        return await this.requestJson<OverpassResponse>(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=UTF-8',
            'User-Agent': this.options.userAgent,
          },
          body,
        });
      } catch (error) {
        if (error instanceof SearchProviderError) {
          if (!error.retryable) throw error;
          lastError = error;
          continue;
        }
        throw error;
      }
    }

    throw (
      lastError ??
      new SearchProviderError({
        provider: 'OPENSTREETMAP',
        message: 'OpenStreetMap provider request failed',
        publicMessage: 'Search provider is temporarily unavailable. Please try again later.',
        retryable: true,
        reason: 'OVERPASS_UNAVAILABLE',
      })
    );
  }

  private async findMunicipality(
    city: string,
    region: string,
    country: ProspectingCountryCode,
  ): Promise<NominatimMunicipality | undefined> {
    const cacheKey = `${normalizeText(city)}:${normalizeText(region)}:${country}`;
    const cached = this.municipalityCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.municipalityCache.delete(cacheKey);
      this.municipalityCache.set(cacheKey, cached);
      return cached.municipality;
    }
    if (cached) this.municipalityCache.delete(cacheKey);

    const municipality = this.fetchMunicipality(city, region, country);
    const maxEntries = Math.max(1, this.options.municipalityCacheMaxEntries ?? 500);
    while (this.municipalityCache.size >= maxEntries) {
      const oldestKey = this.municipalityCache.keys().next().value;
      if (oldestKey === undefined) break;
      this.municipalityCache.delete(oldestKey);
    }
    this.municipalityCache.set(cacheKey, {
      municipality,
      expiresAt: Date.now() + (this.options.municipalityCacheTtlMs ?? 15 * 60 * 1000),
    });
    try {
      return await municipality;
    } catch (error) {
      this.municipalityCache.delete(cacheKey);
      throw error;
    }
  }

  private async fetchMunicipality(
    city: string,
    region: string,
    country: ProspectingCountryCode,
  ): Promise<NominatimMunicipality | undefined> {
    const url = new URL(this.options.nominatimUrl);
    url.search = new URLSearchParams({
      q: `${city}, ${region}, ${countryDisplayName(country)}`,
      countrycodes: country.toLowerCase(),
      format: 'jsonv2',
      addressdetails: '1',
      extratags: '1',
      limit: '10',
    }).toString();

    const places = await this.requestJson<NominatimPlace[]>(
      url.toString(),
      { headers: { 'User-Agent': this.options.userAgent } },
      true,
    );

    const candidates = places.filter(
      (place) => place.osm_type === 'relation'
        && typeof place.osm_id === 'number'
        && matchesCountry(place, country)
        && hasRequestedRegion(place, region, country)
        && hasRequestedCity(place, city),
    );

    const municipality = candidates.find((place) => isMunicipalityRelation(place))
      ?? candidates.find((place) => getAdminLevel(place) !== 4)
      ?? candidates[0];

    if (!municipality || municipality.osm_type !== 'relation' || typeof municipality.osm_id !== 'number') {
      return undefined;
    }

    return {
      ...municipality,
      osm_id: municipality.osm_id,
      osm_type: 'relation',
      boundingBox: parseBoundingBox(municipality.boundingbox),
    };
  }

  private async requestJson<T>(url: string, init: RequestInit, applyNominatimRateLimit = false): Promise<T> {
    const maxAttempts = 3;
    let lastError: ProviderRequestError | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (applyNominatimRateLimit) {
        try {
          await this.rateLimiter.waitForTurn();
        } catch {
          throw new SearchProviderError({
            provider: 'OPENSTREETMAP',
            message: 'OpenStreetMap provider request failed',
            publicMessage: 'Search provider is temporarily unavailable. Please try again later.',
            retryable: true,
            reason: 'RATE_LIMIT_SLOT',
          });
        }
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
      let retryAfterMs: number | undefined;

      try {
        const response = await this.fetchImplementation(url, { ...init, signal: controller.signal });
        if (!response.ok) {
          throw new ProviderRequestError(
            isTransientStatus(response.status),
            `HTTP_${response.status}`,
            response.status,
            getRetryAfterMs(response),
          );
        }

        try {
          return (await response.json()) as T;
        } catch {
          throw new ProviderRequestError(false, 'INVALID_JSON', response.status);
        }
      } catch (error) {
        if (error instanceof ProviderRequestError) {
          lastError = error;
          if (!error.retryable) throw toSearchProviderError(error);
          retryAfterMs = error.retryAfterMs;
        } else if (error instanceof Error && error.name === 'AbortError') {
          lastError = new ProviderRequestError(true, 'TIMEOUT');
          retryAfterMs = undefined;
        } else {
          lastError = new ProviderRequestError(true, 'NETWORK_ERROR');
        }
      } finally {
        clearTimeout(timeout);
      }

      if (attempt === maxAttempts - 1) break;
      await new Promise<void>((resolve) => setTimeout(resolve, retryAfterMs ?? 100 * 2 ** attempt));
    }

    throw toSearchProviderError(
      lastError ?? new ProviderRequestError(true, 'UPSTREAM_UNAVAILABLE'),
    );
  }
}

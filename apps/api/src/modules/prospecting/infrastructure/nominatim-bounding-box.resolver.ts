import {
  countryDisplayName,
  isBrazilianStateCode,
  type BrazilianStateCode,
  type ProspectingCountryCode,
} from '../domain/search-provider';
import {
  parseNominatimBoundingBox,
  type GeographicBoundingBox,
} from '../domain/geographic-bounding-box';
import type { NominatimRateLimiter } from './nominatim-rate-limiter';

export interface BoundingBoxResolveInput {
  city: string;
  region: string;
  country: ProspectingCountryCode;
  neighborhood?: string;
}

export interface BoundingBoxResolver {
  resolve(input: BoundingBoxResolveInput): Promise<GeographicBoundingBox | undefined>;
}

export interface NominatimBoundingBoxResolverOptions {
  nominatimUrl: string;
  userAgent: string;
  timeoutMs: number;
  rateLimiter?: NominatimRateLimiter;
  fetch?: typeof fetch;
}

interface NominatimPlace {
  osm_id?: number;
  osm_type?: string;
  display_name?: string;
  address?: Record<string, unknown>;
  extratags?: Record<string, string>;
  boundingbox?: string[];
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

function matchesCountry(place: NominatimPlace, country: ProspectingCountryCode): boolean {
  const code = place.address?.country_code;
  return typeof code !== 'string' || code.toLowerCase() === country.toLowerCase();
}

function hasRequestedRegion(
  place: NominatimPlace,
  region: string,
  country: ProspectingCountryCode,
): boolean {
  const address = place.address ?? {};
  const normalizedRegion = normalizeText(region);

  if (country === 'BR' && isBrazilianStateCode(region.toUpperCase())) {
    const state = region.toUpperCase() as BrazilianStateCode;
    const isoState = address['ISO3166-2-lvl4'] ?? address.ISO3166_2_lvl4;
    if (typeof isoState === 'string' && isoState.toUpperCase() === `BR-${state}`) {
      return true;
    }
    const placeState = address.state;
    return typeof placeState === 'string' && normalizeText(placeState) === STATE_NAMES[state];
  }

  const candidates = [address.state, address.county, address.region, address.province];
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

export class NominatimBoundingBoxResolver implements BoundingBoxResolver {
  private readonly fetchImplementation: typeof fetch;
  private readonly rateLimiter: NominatimRateLimiter;

  constructor(private readonly options: NominatimBoundingBoxResolverOptions) {
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    this.rateLimiter = options.rateLimiter ?? { waitForTurn: async () => undefined };
    if (!this.fetchImplementation) throw new Error('Fetch API is unavailable');
  }

  async resolve(input: BoundingBoxResolveInput): Promise<GeographicBoundingBox | undefined> {
    const neighborhood = input.neighborhood?.trim();
    if (neighborhood) {
      const neighborhoodBox = await this.lookup(
        `${neighborhood}, ${input.city}, ${input.region}, ${countryDisplayName(input.country)}`,
        input,
        { requireCity: false, limit: 5 },
      );
      if (neighborhoodBox) return neighborhoodBox;
    }

    return this.lookup(
      `${input.city}, ${input.region}, ${countryDisplayName(input.country)}`,
      input,
      { requireCity: true, limit: 10 },
    );
  }

  private async lookup(
    query: string,
    input: BoundingBoxResolveInput,
    options: { requireCity: boolean; limit: number },
  ): Promise<GeographicBoundingBox | undefined> {
    const url = new URL(this.options.nominatimUrl);
    url.search = new URLSearchParams({
      q: query,
      countrycodes: input.country.toLowerCase(),
      format: 'jsonv2',
      addressdetails: '1',
      extratags: '1',
      limit: String(options.limit),
    }).toString();

    const places = await this.requestPlaces(url.toString());
    if (!places) return undefined;

    for (const place of places) {
      if (!matchesCountry(place, input.country)) continue;
      if (!hasRequestedRegion(place, input.region, input.country)) continue;
      if (options.requireCity && !hasRequestedCity(place, input.city)) continue;
      if (!options.requireCity && !hasRequestedCity(place, input.city) && !hasRequestedRegion(place, input.region, input.country)) {
        continue;
      }
      const boundingBox = parseNominatimBoundingBox(place.boundingbox);
      if (boundingBox) return boundingBox;
    }
    return undefined;
  }

  private async requestPlaces(url: string): Promise<NominatimPlace[] | undefined> {
    try {
      await this.rateLimiter.waitForTurn();
    } catch {
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await this.fetchImplementation(url, {
        headers: { 'User-Agent': this.options.userAgent },
        signal: controller.signal,
      });
      if (!response.ok) return undefined;
      const body = (await response.json()) as unknown;
      return Array.isArray(body) ? (body as NominatimPlace[]) : undefined;
    } catch {
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }
}

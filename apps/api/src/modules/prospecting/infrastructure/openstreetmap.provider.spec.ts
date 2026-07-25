import { WebsitePresence } from '@prisma/client';

import { configuration } from '../../../config/configuration';
import { validateEnv } from '../../../config/validation';
import { mapCategoryToOsmTags } from './osm-category-map';
import { OpenStreetMapProvider, type OpenStreetMapProviderOptions } from './openstreetmap.provider';

const fetchMock = jest.fn();

const createProvider = (options: Partial<OpenStreetMapProviderOptions> = {}) =>
  new OpenStreetMapProvider({
    nominatimUrl: 'https://nominatim.test/search',
    overpassUrl: 'https://overpass.test/api/interpreter',
    userAgent: 'prospectly-test/1.0',
    timeoutMs: 500,
    resultLimit: 25,
    fetch: fetchMock,
    ...options,
  });

const httpResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  }) as Response;

const jsonResponse = (body: unknown) => httpResponse(200, body);

describe('OpenStreetMapProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'])(
    'accepts the Brazilian UF %s',
    async (state) => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]));

      await expect(
        createProvider().search({ category: 'restaurant', city: 'São Paulo', state, country: 'BR' as const, onlyWithoutWebsite: true }),
      ).resolves.toEqual([]);
    },
  );

  it('rejects an invalid Brazilian UF before making a provider request', async () => {
    await expect(
      createProvider().search({ category: 'restaurant', city: 'São Paulo', state: 'XX', country: 'BR' as const, onlyWithoutWebsite: true }),
    ).rejects.toThrow('Invalid Brazilian state: XX');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['restaurant', { amenity: ['restaurant'] }],
    ['pharmacy', { amenity: ['pharmacy'] }],
    ['supermarket', { shop: ['supermarket'] }],
    ['bakery', { shop: ['bakery'] }],
    ['carpenter', { craft: ['carpenter'] }],
    ['accountant', { office: ['accountant'] }],
    ['hotel', { tourism: ['hotel'] }],
  ])('maps category %s to supported OSM commercial tags', (category, expected) => {
    expect(mapCategoryToOsmTags(category)).toEqual(expected);
  });

  it('rejects an empty or unsupported category', () => {
    expect(() => mapCategoryToOsmTags('')).toThrow('Unsupported OpenStreetMap category');
    expect(() => mapCategoryToOsmTags('spaceship repair')).toThrow('Unsupported OpenStreetMap category');
  });

  it('selects the municipality that matches the requested Brazilian UF', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          { osm_id: 1, osm_type: 'relation', display_name: 'São Paulo, Brazil', address: { state: 'Rio de Janeiro', country_code: 'br' } },
          { osm_id: 3550308, osm_type: 'relation', display_name: 'São Paulo, São Paulo, Brazil', address: { city: 'São Paulo', state: 'São Paulo', ISO3166_2_lvl4: 'BR-SP', country_code: 'br' } },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ elements: [] }));

    await expect(
      createProvider().search({ category: 'restaurant', city: 'São Paulo', state: 'SP', country: 'BR' as const, onlyWithoutWebsite: true }),
    ).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('countrycodes=br'),
      expect.objectContaining({ headers: expect.objectContaining({ 'User-Agent': 'prospectly-test/1.0' }) }),
    );
    const nominatimUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(nominatimUrl.searchParams.get('q')).toBe('São Paulo, SP, Brasil');
    expect(nominatimUrl.searchParams.get('extratags')).toBe('1');
    expect(nominatimUrl.searchParams.has('city')).toBe(false);
    expect(nominatimUrl.searchParams.has('state')).toBe(false);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain('area(3603550308)');
  });

  it('prefers the municipality admin_level over the state relation with the same name', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          {
            osm_id: 298204,
            osm_type: 'relation',
            display_name: 'São Paulo, Brasil',
            address: { municipality: 'São Paulo', state: 'São Paulo', ISO3166_2_lvl4: 'BR-SP', country_code: 'br' },
            extratags: { admin_level: '4' },
          },
          {
            osm_id: 298285,
            osm_type: 'relation',
            display_name: 'São Paulo, São Paulo, Brasil',
            address: { municipality: 'São Paulo', state: 'São Paulo', ISO3166_2_lvl4: 'BR-SP', country_code: 'br' },
            extratags: { admin_level: '8', place: 'municipality' },
            boundingbox: ['-24.0079003', '-23.3577551', '-46.8262692', '-46.3650898'],
          },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ elements: [] }));

    await createProvider().search({ category: 'restaurant', city: 'São Paulo', state: 'SP', country: 'BR' as const, onlyWithoutWebsite: true });

    const overpassBody = String(fetchMock.mock.calls[1]?.[1]?.body);
    expect(overpassBody).toContain('(-24.0079003,-46.8262692,-23.3577551,-46.3650898)');
    expect(overpassBody).toContain('node["amenity"="restaurant"]');
    expect(overpassBody).toContain('way["amenity"="restaurant"]');
    expect(overpassBody).not.toContain('nwr[');
    expect(overpassBody).not.toContain('area(3600298204)');
  });

  it('queries Overpass by bounding box when Nominatim provides one', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          {
            osm_id: 298285,
            osm_type: 'relation',
            address: { city: 'São Paulo', ISO3166_2_lvl4: 'BR-SP', country_code: 'br' },
            extratags: { admin_level: '8' },
            boundingbox: ['-24.0', '-23.3', '-46.8', '-46.3'],
          },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ elements: [] }));

    await createProvider({ timeoutMs: 45_000 }).search({
      category: 'restaurant',
      city: 'São Paulo',
      state: 'SP',
      country: 'BR' as const, onlyWithoutWebsite: true,
    });

    const overpassBody = String(fetchMock.mock.calls[1]?.[1]?.body);
    expect(overpassBody).toContain('[timeout:40]');
    expect(overpassBody).toContain('(-24,-46.8,-23.3,-46.3)');
    expect(overpassBody).not.toContain('area(');
  });

  it('falls back to Overpass area query when the Nominatim bbox is oversized', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          {
            osm_id: 326252,
            osm_type: 'relation',
            address: { municipality: 'Jordão', ISO3166_2_lvl4: 'BR-AC', country_code: 'br' },
            extratags: { admin_level: '8', place: 'municipality' },
            boundingbox: ['-9.7962197', '-8.6480123', '-72.3410009', '-71.4825955'],
          },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ elements: [] }));

    await createProvider().search({
      category: 'cafe',
      city: 'Jordão',
      state: 'AC',
      country: 'BR' as const,
      onlyWithoutWebsite: true,
    });

    const overpassBody = String(fetchMock.mock.calls[1]?.[1]?.body);
    expect(overpassBody).toContain('area(3600326252)');
    expect(overpassBody).not.toContain('(-9.7962197');
  });

  it('batches multiple categories into a single Overpass query', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          {
            osm_id: 298285,
            osm_type: 'relation',
            address: { city: 'São Paulo', ISO3166_2_lvl4: 'BR-SP', country_code: 'br' },
            extratags: { admin_level: '8' },
            boundingbox: ['-24.0', '-23.3', '-46.8', '-46.3'],
          },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ elements: [] }));

    await createProvider().search({
      category: 'restaurant',
      categories: ['restaurant', 'pharmacy', 'hotel'],
      city: 'São Paulo',
      state: 'SP',
      country: 'BR' as const,
      onlyWithoutWebsite: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const overpassBody = String(fetchMock.mock.calls[1]?.[1]?.body);
    expect(overpassBody).toContain('node["amenity"="restaurant"]');
    expect(overpassBody).toContain('node["amenity"="pharmacy"]');
    expect(overpassBody).toContain('node["tourism"="hotel"]');
  });

  it('retries Overpass on a configured mirror after the primary endpoint fails', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          {
            osm_id: 298285,
            osm_type: 'relation',
            address: { city: 'São Paulo', ISO3166_2_lvl4: 'BR-SP', country_code: 'br' },
            extratags: { admin_level: '8' },
          },
        ]),
      )
      .mockResolvedValueOnce(httpResponse(504, { error: 'gateway timeout' }))
      .mockResolvedValueOnce(httpResponse(504, { error: 'gateway timeout' }))
      .mockResolvedValueOnce(httpResponse(504, { error: 'gateway timeout' }))
      .mockResolvedValueOnce(jsonResponse({ elements: [] }));

    await expect(
      createProvider({
        overpassUrl: 'https://overpass.primary.test/interpreter',
        overpassUrls: [
          'https://overpass.primary.test/interpreter',
          'https://overpass.mirror.test/interpreter',
        ],
        timeoutMs: 50,
      }).search({
        category: 'restaurant',
        city: 'São Paulo',
        state: 'SP',
        country: 'BR' as const,
        onlyWithoutWebsite: true,
      }),
    ).resolves.toEqual([]);

    const overpassUrls = fetchMock.mock.calls.slice(1).map(([url]) => String(url));
    expect(overpassUrls).toContain('https://overpass.primary.test/interpreter');
    expect(overpassUrls).toContain('https://overpass.mirror.test/interpreter');
  });

  it('rejects a same-UF relation for a different city and matches normalized municipality fields', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          { osm_id: 3549904, osm_type: 'relation', address: { city: 'São José dos Campos', ISO3166_2_lvl4: 'BR-SP', country_code: 'br' } },
          { osm_id: 3550308, osm_type: 'relation', address: { town: 'Sao Paulo', ISO3166_2_lvl4: 'BR-SP', country_code: 'br' } },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ elements: [] }));

    await createProvider().search({ category: 'restaurant', city: 'São Paulo', state: 'SP', country: 'BR' as const, onlyWithoutWebsite: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain('area(3603550308)');
  });

  it('escapes Overpass category values and normalizes the preferred website tag', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          { osm_id: 3550308, osm_type: 'relation', display_name: 'São Paulo, São Paulo, Brazil', address: { ISO3166_2_lvl4: 'BR-SP', country_code: 'br' } },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          elements: [
            {
              type: 'node',
              id: 42,
              lat: -23.55052,
              lon: -46.633308,
              tags: {
                name: 'Padaria Central',
                amenity: 'restaurant',
                website: 'https://website.example',
                'contact:website': 'https://contact.example',
                url: 'https://url.example',
                'addr:street': 'Rua das Flores',
                'addr:housenumber': '100',
                'addr:postcode': '01000-000',
                phone: '+55 11 99999-0000',
                email: 'contato@padaria.example',
              },
            },
            {
              type: 'way',
              id: 43,
              center: { lat: -23.55, lon: -46.63 },
              tags: { name: 'Sem Site', shop: 'bakery' },
            },
          ],
        }),
      );

    const results = await createProvider().search({
      category: 'restaurant',
      city: 'São Paulo',
      state: 'SP',
      country: 'BR' as const, onlyWithoutWebsite: false,
    });

    expect(fetchMock.mock.calls[1]?.[1]?.body).not.toContain('undefined');
    expect(results).toEqual([
      expect.objectContaining({
        externalId: 'node/42',
        companyName: 'Padaria Central',
        category: 'restaurant',
        website: 'https://website.example',
        websitePresence: WebsitePresence.WEBSITE_FOUND,
        address: 'Rua das Flores, 100',
        postalCode: '01000-000',
        city: 'São Paulo',
        state: 'SP',
        country: 'BR',
        source: 'OPENSTREETMAP',
      }),
      expect.objectContaining({
        externalId: 'way/43',
        companyName: 'Sem Site',
        website: undefined,
        websitePresence: WebsitePresence.NO_WEBSITE_REPORTED,
        latitude: -23.55,
        longitude: -46.63,
      }),
    ]);
  });

  it('caches a validated municipality for repeated searches in the same city and UF', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          { osm_id: 3550308, osm_type: 'relation', address: { city: 'São Paulo', ISO3166_2_lvl4: 'BR-SP', country_code: 'br' } },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ elements: [] }))
      .mockResolvedValueOnce(jsonResponse({ elements: [] }));
    const provider = createProvider();
    const input = { category: 'restaurant', city: 'São Paulo', state: 'SP', country: 'BR' as const, onlyWithoutWebsite: true };

    await provider.search(input);
    await provider.search(input);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('nominatim.test'))).toHaveLength(1);
  });

  it('expires municipality cache entries after their TTL', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let now = 10_000;
    nowSpy.mockImplementation(() => now);
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ osm_id: 3550308, osm_type: 'relation', address: { city: 'São Paulo', ISO3166_2_lvl4: 'BR-SP', country_code: 'br' } }]))
      .mockResolvedValueOnce(jsonResponse({ elements: [] }))
      .mockResolvedValueOnce(jsonResponse([{ osm_id: 3550308, osm_type: 'relation', address: { city: 'São Paulo', ISO3166_2_lvl4: 'BR-SP', country_code: 'br' } }]))
      .mockResolvedValueOnce(jsonResponse({ elements: [] }));
    const provider = createProvider({ municipalityCacheTtlMs: 1_000 });
    const input = { category: 'restaurant', city: 'São Paulo', state: 'SP', country: 'BR' as const, onlyWithoutWebsite: true };

    try {
      await provider.search(input);
      now += 1_001;
      await provider.search(input);
    } finally {
      nowSpy.mockRestore();
    }

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('nominatim.test'))).toHaveLength(2);
  });

  it('evicts the least recently used municipality when the cache reaches its entry limit', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ osm_id: 3550308, osm_type: 'relation', address: { city: 'São Paulo', ISO3166_2_lvl4: 'BR-SP', country_code: 'br' } }]))
      .mockResolvedValueOnce(jsonResponse({ elements: [] }))
      .mockResolvedValueOnce(jsonResponse([{ osm_id: 3304557, osm_type: 'relation', address: { city: 'Rio de Janeiro', ISO3166_2_lvl4: 'BR-RJ', country_code: 'br' } }]))
      .mockResolvedValueOnce(jsonResponse({ elements: [] }))
      .mockResolvedValueOnce(jsonResponse([{ osm_id: 3550308, osm_type: 'relation', address: { city: 'São Paulo', ISO3166_2_lvl4: 'BR-SP', country_code: 'br' } }]))
      .mockResolvedValueOnce(jsonResponse({ elements: [] }));
    const provider = createProvider({ municipalityCacheMaxEntries: 1 });

    await provider.search({ category: 'restaurant', city: 'São Paulo', state: 'SP', country: 'BR' as const, onlyWithoutWebsite: true });
    await provider.search({ category: 'restaurant', city: 'Rio de Janeiro', state: 'RJ', country: 'BR' as const, onlyWithoutWebsite: true });
    await provider.search({ category: 'restaurant', city: 'São Paulo', state: 'SP', country: 'BR' as const, onlyWithoutWebsite: true });

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('nominatim.test'))).toHaveLength(3);
  });

  it('retries transient provider failures without leaking their internal cause', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('upstream private detail'))
      .mockResolvedValueOnce(
        jsonResponse([
          { osm_id: 3550308, osm_type: 'relation', address: { city: 'São Paulo', ISO3166_2_lvl4: 'BR-SP', country_code: 'br' } },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ elements: [] }));

    await expect(
      createProvider().search({ category: 'restaurant', city: 'São Paulo', state: 'SP', country: 'BR' as const, onlyWithoutWebsite: true }),
    ).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('acquires the global Nominatim rate limit before every attempt including retries', async () => {
    const rateLimiter = { waitForTurn: jest.fn().mockResolvedValue(undefined) };
    fetchMock
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce(jsonResponse([]));

    await createProvider({ rateLimiter }).search({
      category: 'restaurant',
      city: 'São Paulo',
      state: 'SP',
      country: 'BR' as const, onlyWithoutWebsite: true,
    });

    expect(rateLimiter.waitForTurn).toHaveBeenCalledTimes(2);
  });

  it('does not retry permanent provider HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(httpResponse(404, { error: 'not found' }));

    await expect(
      createProvider().search({ category: 'restaurant', city: 'São Paulo', state: 'SP', country: 'BR' as const, onlyWithoutWebsite: true }),
    ).rejects.toThrow('OpenStreetMap provider request failed');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses Portuguese countrycodes and region query for Lisboa', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          {
            osm_id: 5326784,
            osm_type: 'relation',
            display_name: 'Lisboa, Portugal',
            address: { city: 'Lisboa', state: 'Lisboa', country_code: 'pt' },
            extratags: { admin_level: '8', place: 'city' },
            boundingbox: ['38.69', '38.80', '-9.23', '-9.08'],
          },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ elements: [] }));

    await expect(
      createProvider().search({
        category: 'restaurant',
        city: 'Lisboa',
        state: 'Lisboa',
        country: 'PT',
        onlyWithoutWebsite: true,
      }),
    ).resolves.toEqual([]);

    const nominatimUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(nominatimUrl.searchParams.get('countrycodes')).toBe('pt');
    expect(nominatimUrl.searchParams.get('q')).toBe('Lisboa, Lisboa, Portugal');
  });
});

describe('OpenStreetMap configuration', () => {
  it('exposes configurable OpenStreetMap endpoints and request limits', () => {
    const originalEnvironment = process.env;
    process.env = {
      ...originalEnvironment,
      OSM_NOMINATIM_URL: 'https://nominatim.example/search',
      OSM_OVERPASS_URL: 'https://overpass.example/interpreter',
      OSM_USER_AGENT: 'prospectly/1.0',
      OSM_TIMEOUT_MS: '6500',
      OSM_RESULT_LIMIT: '75',
    };

    try {
      expect(configuration().openStreetMap).toEqual({
        nominatimUrl: 'https://nominatim.example/search',
        overpassUrl: 'https://overpass.example/interpreter',
        userAgent: 'prospectly/1.0',
        timeoutMs: 6500,
        resultLimit: 75,
      });
    } finally {
      process.env = originalEnvironment;
    }
  });

  it('rejects malformed OpenStreetMap URLs and unsafe numeric limits', () => {
    const baseConfig = {
      DATABASE_URL: 'postgresql://localhost/prospectly',
      JWT_ACCESS_SECRET: '12345678901234567890123456789012',
      JWT_REFRESH_SECRET: '12345678901234567890123456789012',
      OSM_NOMINATIM_URL: 'not-a-url',
      OSM_OVERPASS_URL: 'https://overpass.example/interpreter',
      OSM_USER_AGENT: 'prospectly/1.0',
      OSM_TIMEOUT_MS: '0',
      OSM_RESULT_LIMIT: '-1',
    };

    expect(() => validateEnv(baseConfig)).toThrow('OSM_NOMINATIM_URL must be a valid URL');
  });
});

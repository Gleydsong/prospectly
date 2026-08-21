import { NominatimBoundingBoxResolver } from './nominatim-bounding-box.resolver';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('NominatimBoundingBoxResolver', () => {
  it('returns the municipality bounding box for a Brazilian city', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse([
        {
          osm_id: 1,
          osm_type: 'relation',
          display_name: 'Anamã, Amazonas, Brasil',
          boundingbox: ['-3.6849083', '-3.2631108', '-62.0879000', '-61.2791861'],
          address: {
            village: 'Anamã',
            state: 'Amazonas',
            ISO3166_2_lvl4: 'BR-AM',
            country_code: 'br',
          },
        },
      ]),
    );

    const resolver = new NominatimBoundingBoxResolver({
      nominatimUrl: 'https://nominatim.test/search',
      userAgent: 'Prospectly-test',
      timeoutMs: 5_000,
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      resolver.resolve({ city: 'Anamã', region: 'AM', country: 'BR' }),
    ).resolves.toEqual({
      south: -3.6849083,
      north: -3.2631108,
      west: -62.0879,
      east: -61.2791861,
    });

    const calledUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(calledUrl.searchParams.get('q')).toBe('Anamã, AM, Brasil');
    expect(calledUrl.searchParams.get('countrycodes')).toBe('br');
  });

  it('returns undefined when Nominatim is unavailable', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('network'));
    const resolver = new NominatimBoundingBoxResolver({
      nominatimUrl: 'https://nominatim.test/search',
      userAgent: 'Prospectly-test',
      timeoutMs: 5_000,
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      resolver.resolve({ city: 'Anamã', region: 'AM', country: 'BR' }),
    ).resolves.toBeUndefined();
  });
});

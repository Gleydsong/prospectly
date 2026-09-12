import { WebsitePresence } from '@prisma/client';

import { GooglePlacesProvider } from './google-places.provider';
import { NominatimBoundingBoxResolver } from './nominatim-bounding-box.resolver';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('GooglePlacesProvider', () => {
  it('maps Text Search places and filters businesses without website when requested', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({
          places: [
            {
              id: 'ChIJ1',
              displayName: { text: 'Padaria Sem Site' },
              formattedAddress: 'Rua A, São Paulo - SP',
              nationalPhoneNumber: '(11) 3000-0000',
              addressComponents: [
                { longText: 'São Paulo', shortText: 'São Paulo', types: ['locality'] },
                { longText: 'São Paulo', shortText: 'SP', types: ['administrative_area_level_1'] },
                { longText: '01310-100', types: ['postal_code'] },
              ],
              location: { latitude: -23.5, longitude: -46.6 },
            },
            {
              id: 'ChIJ2',
              displayName: { text: 'Padaria Com Site' },
              websiteUri: 'https://padaria.example',
              addressComponents: [
                { longText: 'São Paulo', types: ['locality'] },
                { shortText: 'SP', types: ['administrative_area_level_1'] },
              ],
            },
          ],
        }),
      );

    const provider = new GooglePlacesProvider({
      apiKey: 'test-key',
      timeoutMs: 5_000,
      resultLimit: 20,
      fetch: fetchMock as unknown as typeof fetch,
    });

    const results = await provider.search({
      category: 'bakery',
      city: 'São Paulo',
      state: 'SP',
      country: 'BR', onlyWithoutWebsite: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:searchText',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Goog-Api-Key': 'test-key',
        }),
      }),
    );
    expect(results).toEqual([
      expect.objectContaining({
        externalId: 'places/ChIJ1',
        companyName: 'Padaria Sem Site',
        source: 'GOOGLE_PLACES',
        websitePresence: WebsitePresence.NO_WEBSITE_REPORTED,
        state: 'SP',
        city: 'São Paulo',
      }),
    ]);
  });

  it('returns places with and without website when onlyWithoutWebsite is false', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        places: [
          {
            id: 'ChIJ1',
            displayName: { text: 'Padaria Sem Site' },
            addressComponents: [
              { longText: 'São Paulo', types: ['locality'] },
              { shortText: 'SP', types: ['administrative_area_level_1'] },
            ],
          },
          {
            id: 'ChIJ2',
            displayName: { text: 'Padaria Com Site' },
            websiteUri: 'https://padaria.example',
            addressComponents: [
              { longText: 'São Paulo', types: ['locality'] },
              { shortText: 'SP', types: ['administrative_area_level_1'] },
            ],
          },
        ],
      }),
    );

    const provider = new GooglePlacesProvider({
      apiKey: 'test-key',
      timeoutMs: 5_000,
      resultLimit: 20,
      fetch: fetchMock as unknown as typeof fetch,
    });

    const results = await provider.search({
      category: 'bakery',
      city: 'São Paulo',
      state: 'SP',
      country: 'BR',
      onlyWithoutWebsite: false,
    });

    expect(results).toHaveLength(2);
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          companyName: 'Padaria Sem Site',
          websitePresence: WebsitePresence.NO_WEBSITE_REPORTED,
        }),
        expect.objectContaining({
          companyName: 'Padaria Com Site',
          websitePresence: WebsitePresence.WEBSITE_FOUND,
          website: 'https://padaria.example',
        }),
      ]),
    );
  });

  it('sanitizes upstream failures without leaking response secrets', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ error: { message: 'key=secret' } }, 500));
    const provider = new GooglePlacesProvider({
      apiKey: 'test-key',
      timeoutMs: 5_000,
      resultLimit: 20,
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      provider.search({
        category: 'restaurant',
        city: 'São Paulo',
        state: 'SP',
        country: 'BR', onlyWithoutWebsite: false,
      }),
    ).rejects.toMatchObject({
      message: 'Google Places provider request failed',
      publicMessage: 'Search provider is temporarily unavailable. Please try again later.',
      retryable: true,
      statusCode: 500,
    });
  });

  it('maps SERVICE_DISABLED 403 to a permanent actionable public message', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            status: 'PERMISSION_DENIED',
            details: [{ reason: 'SERVICE_DISABLED' }],
          },
        },
        403,
      ),
    );
    const provider = new GooglePlacesProvider({
      apiKey: 'test-key',
      timeoutMs: 5_000,
      resultLimit: 20,
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      provider.search({
        category: 'bakery',
        city: 'São Paulo',
        state: 'SP',
        country: 'BR', onlyWithoutWebsite: true,
      }),
    ).rejects.toMatchObject({
      retryable: false,
      statusCode: 403,
      reason: 'SERVICE_DISABLED',
      publicMessage: expect.stringContaining('Places API (New) is disabled'),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses regionCode BR and Portuguese language for Brazil searches', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        places: [
          {
            id: 'ChIJCuritiba',
            displayName: { text: 'Padaria Batel' },
            formattedAddress: 'Curitiba, PR, Brasil',
            internationalPhoneNumber: '+55 41 3000 0000',
            addressComponents: [
              { longText: 'Curitiba', types: ['locality'] },
              { longText: 'Paraná', shortText: 'PR', types: ['administrative_area_level_1'] },
            ],
          },
        ],
      }),
    );
    const provider = new GooglePlacesProvider({
      apiKey: 'test-key',
      timeoutMs: 5_000,
      resultLimit: 20,
      fetch: fetchMock as unknown as typeof fetch,
    });

    const results = await provider.search({
      category: 'bakery',
      city: 'Curitiba',
      state: 'PR',
      country: 'BR',
      onlyWithoutWebsite: false,
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.regionCode).toBe('BR');
    expect(body.languageCode).toBe('pt-BR');
    expect(body.textQuery).toContain('Curitiba');
    expect(body.textQuery).toContain('Brasil');
    expect(results).toEqual([
      expect.objectContaining({
        companyName: 'Padaria Batel',
        country: 'BR',
        state: 'PR',
        city: 'Curitiba',
      }),
    ]);
  });

  it('keeps only places in the requested city when Google ranks a nearby capital higher', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        places: [
          {
            id: 'ChIJManaus',
            displayName: { text: 'Café da Ana - am' },
            formattedAddress: 'Av. Ten. Roxana Bonessi, 1692, Manaus - AM, 69093-828',
            primaryType: 'cafe',
            addressComponents: [
              { longText: 'Manaus', types: ['locality'] },
              { shortText: 'AM', types: ['administrative_area_level_1'] },
            ],
          },
          {
            id: 'ChIJAnama',
            displayName: { text: 'Restaurante Regional' },
            formattedAddress: 'Estr. Anama Cuia, 240, Anamã - AM, 69445-000',
            primaryType: 'restaurant',
            types: ['restaurant', 'food'],
            addressComponents: [
              { longText: 'Anamã', types: ['locality'] },
              { shortText: 'AM', types: ['administrative_area_level_1'] },
            ],
          },
        ],
      }),
    );
    const provider = new GooglePlacesProvider({
      apiKey: 'test-key',
      timeoutMs: 5_000,
      resultLimit: 20,
      fetch: fetchMock as unknown as typeof fetch,
    });

    const results = await provider.search({
      category: 'cafe',
      city: 'Anamã',
      state: 'AM',
      country: 'BR',
      onlyWithoutWebsite: false,
    });

    expect(fetchMock.mock.calls[0]?.[1]?.headers['X-Goog-FieldMask']).toContain('places.primaryType');
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(
      expect.objectContaining({
        companyName: 'Restaurante Regional',
        city: 'Anamã',
        category: 'restaurant',
      }),
    );
  });

  it('sends a Nominatim bounding box as Google locationRestriction', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        places: [
          {
            id: 'ChIJAnama',
            displayName: { text: 'Restaurante Regional' },
            formattedAddress: 'Estr. Anama Cuia, 240, Anamã - AM, 69445-000',
            addressComponents: [
              { longText: 'Anamã', types: ['locality'] },
              { shortText: 'AM', types: ['administrative_area_level_1'] },
            ],
          },
        ],
      }),
    );
    const resolver = new NominatimBoundingBoxResolver({
      nominatimUrl: 'https://nominatim.test/search',
      userAgent: 'Prospectly-test',
      timeoutMs: 5_000,
      fetch: jest.fn().mockResolvedValue(
        jsonResponse([
          {
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
      ) as unknown as typeof fetch,
    });
    const provider = new GooglePlacesProvider({
      apiKey: 'test-key',
      timeoutMs: 5_000,
      resultLimit: 20,
      fetch: fetchMock as unknown as typeof fetch,
      boundingBoxResolver: resolver,
    });

    await provider.search({
      category: 'cafe',
      city: 'Anamã',
      state: 'AM',
      country: 'BR',
      onlyWithoutWebsite: false,
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.locationRestriction.rectangle.low.longitude).toBeLessThan(-61.2);
    expect(body.locationRestriction.rectangle.high.longitude).toBeLessThan(-60.5);
    expect(body.locationRestriction.rectangle.high.latitude).toBeLessThan(-3.2);
  });

  it('searches without restriction when Nominatim cannot resolve the city', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ places: [] }));
    const provider = new GooglePlacesProvider({
      apiKey: 'test-key',
      timeoutMs: 5_000,
      resultLimit: 20,
      fetch: fetchMock as unknown as typeof fetch,
      boundingBoxResolver: {
        resolve: async () => {
          throw new Error('nominatim down');
        },
      },
    });

    await provider.search({
      category: 'cafe',
      city: 'Anamã',
      state: 'AM',
      country: 'BR',
      onlyWithoutWebsite: false,
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.locationRestriction).toBeUndefined();
  });

  it('fans out custom niche text queries instead of the catalog label', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ places: [] }));
    const provider = new GooglePlacesProvider({
      apiKey: 'test-key',
      timeoutMs: 5_000,
      resultLimit: 20,
      fetch: fetchMock as unknown as typeof fetch,
    });

    await provider.search({
      category: 'clinic',
      city: 'Jaboatão dos Guararapes',
      state: 'PE',
      country: 'BR',
      onlyWithoutWebsite: false,
      textQueries: [
        'clinicas em Jaboatão dos Guararapes, PE, Brasil',
        'Clínica em Jaboatão dos Guararapes, PE, Brasil',
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).textQuery).toContain('clinicas');
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).textQuery).toContain('Clínica');
  });

  it('searches a free-text niche without a catalog category', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ places: [] }));
    const provider = new GooglePlacesProvider({
      apiKey: 'test-key',
      timeoutMs: 5_000,
      resultLimit: 20,
      fetch: fetchMock as unknown as typeof fetch,
    });

    await provider.search({
      city: 'Recife',
      state: 'PE',
      country: 'BR',
      onlyWithoutWebsite: false,
      textQueries: ['pet shop em Recife, PE, Brasil'],
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).textQuery).toBe(
      'pet shop em Recife, PE, Brasil',
    );
  });
});

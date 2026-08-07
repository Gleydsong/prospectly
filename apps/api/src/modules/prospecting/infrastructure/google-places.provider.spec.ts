import { WebsitePresence } from '@prisma/client';

import { GooglePlacesProvider } from './google-places.provider';

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
});

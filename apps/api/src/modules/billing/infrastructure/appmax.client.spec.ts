import { AppmaxClient, AppmaxRequestError } from './appmax.client';

describe('AppmaxClient', () => {
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string | number> = {
        'appmax.clientId': 'merchant-client',
        'appmax.clientSecret': 'merchant-secret',
        'appmax.externalId': 'installation-id',
        'appmax.authBaseUrl': 'https://auth.sandboxappmax.com.br',
        'appmax.apiBaseUrl': 'https://api.sandboxappmax.com.br',
        'appmax.httpTimeoutMs': 1000,
      };
      return values[key];
    }),
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses form-encoded OAuth and caches the merchant token', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-1', expires_in: 3600 })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 10 } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 11 } })));
    const client = new AppmaxClient(config as never);

    await client.createCustomer({ email: 'ana@example.com' });
    await client.createCustomer({ email: 'bia@example.com' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const oauthRequest = fetchMock.mock.calls[0]!;
    expect(oauthRequest[0]).toBe('https://auth.sandboxappmax.com.br/oauth2/token');
    expect(oauthRequest[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
        body: expect.any(URLSearchParams),
      }),
    );
    expect(String((oauthRequest[1] as RequestInit).body)).toContain(
      'grant_type=client_credentials',
    );
  });

  it('refreshes an expired credential once after a 401', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-1', expires_in: 3600 })),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-2', expires_in: 3600 })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 123 } })));
    const client = new AppmaxClient(config as never);

    await expect(client.getOrder('123')).resolves.toEqual({ id: 123 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('marks a failed mutation as ambiguous and never retries it automatically', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-1', expires_in: 3600 })),
      )
      .mockResolvedValueOnce(new Response('{"message":"unavailable"}', { status: 503 }));
    const client = new AppmaxClient(config as never);

    await expect(client.createOrder({ customer_id: 10 })).rejects.toMatchObject({
      status: 503,
      ambiguous: true,
    } satisfies Partial<AppmaxRequestError>);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

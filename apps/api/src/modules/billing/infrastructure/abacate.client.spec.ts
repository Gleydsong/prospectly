import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AbacateClient } from './abacate.client';

describe('AbacateClient', () => {
  const configGet = jest.fn((key: string) => {
    const map: Record<string, string | number> = {
      'abacate.apiKey': 'sk_test',
      'abacate.apiBaseUrl': 'https://api.abacatepay.com/v2',
      'abacate.httpTimeoutMs': 15000,
    };
    return map[key];
  });
  const client = new AbacateClient({ get: configGet } as unknown as ConfigService);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a card checkout with methods CARD and requires id+url', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { id: 'bill_1', url: 'https://app.abacatepay.com/pay/bill_1' },
        error: null,
      }),
    } as Response);

    const result = await client.createOneTimeCheckout({
      productId: 'prod_credits_2000',
      returnUrl: 'https://app/cancel',
      completionUrl: 'https://app/success',
      externalId: 'org:org1:credits:p1',
      metadata: { purpose: 'credits' },
    });

    expect(result).toEqual(
      expect.objectContaining({ id: 'bill_1', url: 'https://app.abacatepay.com/pay/bill_1' }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual(
      expect.objectContaining({
        items: [{ id: 'prod_credits_2000', quantity: 1 }],
        methods: ['CARD'],
      }),
    );
  });

  it('creates a subscription checkout with methods CARD', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { id: 'bill_sub', url: 'https://app.abacatepay.com/pay/bill_sub', customerId: 'cust_1' },
        error: null,
      }),
    } as Response);

    const result = await client.createSubscriptionCheckout({
      productId: 'prod_monthly',
      returnUrl: 'https://app/cancel',
      completionUrl: 'https://app/success',
      externalId: 'org:org1:monthly:uuid',
      metadata: { purpose: 'plan' },
    });
    expect(result.customerId).toBe('cust_1');
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).methods).toEqual(['CARD']);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/subscriptions/create');
  });

  it('maps missing checkout url to a safe ServiceUnavailableException', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: 'bill_1' }, error: null }),
    } as Response);

    await expect(
      client.createOneTimeCheckout({
        productId: 'prod_x',
        returnUrl: 'https://app/cancel',
        completionUrl: 'https://app/success',
        externalId: 'ext',
        metadata: {},
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not leak Abacate error bodies', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'internal secret xyz' }),
    } as Response);

    await expect(client.cancelSubscription('subs_1')).rejects.toMatchObject({
      message: 'AbacatePay request failed',
    });
  });
});

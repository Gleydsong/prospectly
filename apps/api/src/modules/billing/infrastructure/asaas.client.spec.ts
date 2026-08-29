import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AsaasClient, AsaasRequestError } from './asaas.client';

describe('AsaasClient', () => {
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string | number> = {
        'asaas.apiKey': 'sandbox-key',
        'asaas.apiBaseUrl': 'https://api-sandbox.asaas.com/v3',
        'asaas.httpTimeoutMs': 15000,
      };
      return values[key];
    }),
  };
  const client = new AsaasClient(config as unknown as ConfigService);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a customer linked to the organization with Asaas notifications disabled', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'cus_000005401844' }),
      } as Response);

    await expect(
      client.ensureCustomer({
        organizationId: 'org-1',
        name: 'Acme Ltda',
        cpfCnpj: '11222333000181',
        phone: '11999999999',
        email: 'financeiro@acme.test',
      }),
    ).resolves.toBe('cus_000005401844');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api-sandbox.asaas.com/v3/customers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          access_token: 'sandbox-key',
          'User-Agent': 'Prospectly/0.1',
          'Content-Type': 'application/json',
        }),
      }),
    );
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'Acme Ltda',
      cpfCnpj: '11222333000181',
      mobilePhone: '11999999999',
      email: 'financeiro@acme.test',
      externalReference: 'prospectly:organization:org-1',
      notificationDisabled: true,
    });
  });

  it('updates payer data on the existing Asaas customer', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'cus_1' }),
    } as Response);

    await expect(
      client.ensureCustomer({
        organizationId: 'org-1',
        name: 'Acme Atualizada',
        cpfCnpj: '11222333000181',
        phone: '11988888888',
        email: 'novo@acme.test',
        existingCustomerId: 'cus_1',
      }),
    ).resolves.toBe('cus_1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api-sandbox.asaas.com/v3/customers/cus_1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('creates a one-time hosted card payment without installments', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'pay_1',
        invoiceUrl: 'https://sandbox.asaas.com/i/pay_1',
        status: 'PENDING',
      }),
    } as Response);

    await expect(
      client.createHostedPayment({
        customerId: 'cus_1',
        amountCentavos: 1499,
        externalReference: 'org:org-1:credits:purchase-1',
        description: 'Prospectly - 2.000 créditos',
        successUrl: 'https://app.test/billing/success',
      }),
    ).resolves.toEqual({
      id: 'pay_1',
      url: 'https://sandbox.asaas.com/i/pay_1',
      status: 'PENDING',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual(
      expect.objectContaining({
        customer: 'cus_1',
        billingType: 'CREDIT_CARD',
        value: 14.99,
        externalReference: 'org:org-1:credits:purchase-1',
        callback: { successUrl: 'https://app.test/billing/success', autoRedirect: true },
      }),
    );
    expect(JSON.parse(String(init.body))).not.toHaveProperty('installmentCount');
  });

  it('classifies a successful POST with an unreadable body as ambiguous', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => null,
    } as Response);

    const error = await client
      .createHostedPayment({
        customerId: 'cus_1',
        amountCentavos: 1499,
        externalReference: 'org:org-1:credits:ambiguous',
        description: 'Prospectly credits',
        successUrl: 'https://app.test/billing/success',
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AsaasRequestError);
    expect((error as AsaasRequestError).ambiguous).toBe(true);
  });

  it('creates a monthly recurring hosted credit checkout', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'checkout-1',
        link: 'https://sandbox.asaas.com/checkoutSession/show/checkout-1',
        status: 'ACTIVE',
      }),
    } as Response);

    await expect(
      client.createRecurringCheckout({
        externalReference: 'org:org-1:monthly-card:attempt-1',
        amountCentavos: 4999,
        customer: {
          name: 'Acme Ltda',
          cpfCnpj: '11222333000181',
          phone: '11999999999',
          email: 'financeiro@acme.test',
        },
        successUrl: 'https://app.test/billing/success',
        cancelUrl: 'https://app.test/billing/cancel',
      }),
    ).resolves.toEqual(expect.objectContaining({ id: 'checkout-1', status: 'ACTIVE' }));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual(
      expect.objectContaining({
        billingTypes: ['CREDIT_CARD'],
        chargeTypes: ['RECURRENT'],
        externalReference: 'org:org-1:monthly-card:attempt-1',
        subscription: { cycle: 'MONTHLY' },
      }),
    );
  });

  it('surfaces Asaas customer validation errors instead of a generic 503', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          errors: [{ code: 'invalid_cpfCnpj', description: 'O CPF informado é inválido' }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response);

    const error = await client
      .ensureCustomer({
        organizationId: 'org-1',
        name: 'Acme Ltda',
        cpfCnpj: '11111111111',
        phone: '11999999999',
        email: 'financeiro@acme.test',
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getStatus()).toBe(400);
    expect((error as BadRequestException).message).toBe('O CPF informado é inválido');
  });

  it('does not leak Asaas credential errors to the payer', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        errors: [
          { code: 'invalid_access_token', description: 'A chave de API fornecida é inválida' },
        ],
      }),
    } as Response);

    const error = await client
      .ensureCustomer({
        organizationId: 'org-1',
        name: 'Acme Ltda',
        cpfCnpj: '11222333000181',
        phone: '11999999999',
        email: 'financeiro@acme.test',
        existingCustomerId: 'cus_1',
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getStatus()).toBe(503);
    expect((error as ServiceUnavailableException).message).toBe(
      'Card payments are temporarily unavailable',
    );
    expect((error as ServiceUnavailableException).message).not.toContain('chave de API');
  });

  it('recreates the Asaas customer when the stored id no longer exists', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          errors: [{ code: 'invalid_object', description: 'Cliente não encontrado' }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'cus_new' }),
      } as Response);

    await expect(
      client.ensureCustomer({
        organizationId: 'org-1',
        name: 'Acme Ltda',
        cpfCnpj: '11222333000181',
        phone: '11999999999',
        email: 'financeiro@acme.test',
        existingCustomerId: 'cus_deleted',
      }),
    ).resolves.toBe('cus_new');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api-sandbox.asaas.com/v3/customers/cus_deleted',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://api-sandbox.asaas.com/v3/customers',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sends landline numbers as phone instead of mobilePhone', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'cus_landline' }),
      } as Response);

    await expect(
      client.ensureCustomer({
        organizationId: 'org-1',
        name: 'Acme Ltda',
        cpfCnpj: '11222333000181',
        phone: '4738010919',
        email: 'financeiro@acme.test',
      }),
    ).resolves.toBe('cus_landline');

    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual(
      expect.objectContaining({
        phone: '4738010919',
      }),
    );
    expect(JSON.parse(String(init.body))).not.toHaveProperty('mobilePhone');
  });
});

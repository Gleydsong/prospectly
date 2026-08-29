import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AsaasCustomerInput = {
  organizationId: string;
  name: string;
  cpfCnpj: string;
  phone: string;
  email: string;
  existingCustomerId?: string | null;
};

export type AsaasPayment = {
  id: string;
  customer?: string;
  value?: number;
  externalReference?: string;
  billingType?: string;
  status?: string;
  subscription?: string;
  dueDate?: string;
  chargebackStatus?: string;
  deleted?: boolean;
};

export class AsaasRequestError extends ServiceUnavailableException {
  constructor(
    readonly ambiguous: boolean,
    readonly httpStatus?: number,
    message = 'Não foi possível comunicar com o provedor de pagamento. Tente novamente.',
  ) {
    super(message);
  }
}

@Injectable()
export class AsaasClient {
  private readonly logger = new Logger(AsaasClient.name);

  constructor(private readonly config: ConfigService) {}

  async ensureCustomer(input: AsaasCustomerInput): Promise<string> {
    if (input.existingCustomerId) {
      try {
        await this.request('PUT', `/customers/${encodeURIComponent(input.existingCustomerId)}`, {
          ...asaasCustomerBody(input),
        });
        return input.existingCustomerId;
      } catch (error) {
        if (!isMissingAsaasCustomer(error)) throw error;
      }
    }
    const externalReference = `prospectly:organization:${input.organizationId}`;
    const existing = await this.findResourceId('/customers', { externalReference });
    if (existing) return existing;
    let response: unknown;
    try {
      response = await this.request('POST', '/customers', {
        ...asaasCustomerBody(input),
        externalReference,
      });
    } catch (error) {
      const recovered = await this.findResourceId('/customers', { externalReference });
      if (recovered) return recovered;
      throw error;
    }
    const id = readString(response, 'id');
    if (!id) {
      this.logger.warn('Asaas customer response missing id');
      throw new AsaasRequestError(true);
    }
    return id;
  }

  async createHostedPayment(input: {
    customerId: string;
    amountCentavos: number;
    externalReference: string;
    description: string;
    successUrl: string;
  }): Promise<{ id: string; url: string; status?: string }> {
    const response = await this.request('POST', '/payments', {
      customer: input.customerId,
      billingType: 'CREDIT_CARD',
      value: input.amountCentavos / 100,
      dueDate: new Date().toISOString().slice(0, 10),
      description: input.description,
      externalReference: input.externalReference,
      callback: { successUrl: input.successUrl, autoRedirect: true },
      canBePaidAfterDueDate: false,
    });
    const id = readString(response, 'id');
    const url = readString(response, 'invoiceUrl');
    if (!id || !url) {
      this.logger.warn('Asaas payment response missing id or invoiceUrl');
      throw new AsaasRequestError(true);
    }
    return { id, url, status: readString(response, 'status') };
  }

  async createRecurringCheckout(input: {
    externalReference: string;
    amountCentavos: number;
    customer: { name: string; cpfCnpj: string; phone: string; email: string };
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ id: string; url: string; status?: string }> {
    const response = await this.request('POST', '/checkouts', {
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      minutesToExpire: 60,
      externalReference: input.externalReference,
      callback: {
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        expiredUrl: input.cancelUrl,
      },
      items: [
        {
          externalReference: 'prospectly-monthly',
          name: 'Prospectly Mensal',
          description: 'Acesso mensal ilimitado ao Prospectly',
          quantity: 1,
          value: input.amountCentavos / 100,
          imageBase64:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        },
      ],
      customerData: input.customer,
      subscription: { cycle: 'MONTHLY' },
    });
    const id = readString(response, 'id');
    const url = readString(response, 'link');
    if (!id || !url) {
      this.logger.warn('Asaas checkout response missing id or link');
      throw new AsaasRequestError(true);
    }
    return { id, url, status: readString(response, 'status') };
  }

  async getPayment(paymentId: string): Promise<AsaasPayment> {
    const response = await this.request('GET', `/payments/${encodeURIComponent(paymentId)}`);
    const id = readString(response, 'id');
    if (!id) {
      throw new AsaasRequestError(false);
    }
    return {
      id,
      customer: readString(response, 'customer'),
      value: readNumber(response, 'value'),
      externalReference: readString(response, 'externalReference'),
      billingType: readString(response, 'billingType'),
      status: readString(response, 'status'),
      subscription: readString(response, 'subscription'),
      dueDate: readString(response, 'dueDate'),
      chargebackStatus: readNestedString(response, 'chargeback', 'status'),
      deleted: readBoolean(response, 'deleted'),
    };
  }

  async findPayment(filters: {
    externalReference?: string;
    checkoutSession?: string;
  }): Promise<AsaasPayment | null> {
    const query = new URLSearchParams({ limit: '1' });
    if (filters.externalReference) query.set('externalReference', filters.externalReference);
    if (filters.checkoutSession) query.set('checkoutSession', filters.checkoutSession);
    const response = await this.request('GET', `/payments?${query.toString()}`);
    const data = readArray(response, 'data');
    const id = data.length > 0 ? readString(data[0], 'id') : undefined;
    return id ? this.getPayment(id) : null;
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.request('DELETE', `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  }

  private async findResourceId(
    path: string,
    filters: Record<string, string>,
  ): Promise<string | null> {
    const query = new URLSearchParams({ limit: '1', ...filters });
    const response = await this.request('GET', `${path}?${query.toString()}`);
    const data = readArray(response, 'data');
    return data.length > 0 ? (readString(data[0], 'id') ?? null) : null;
  }

  private async request(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) {
    const apiKey = this.config.get<string>('asaas.apiKey');
    if (!apiKey) {
      throw new ServiceUnavailableException('Asaas is not configured');
    }
    const baseUrl = (
      this.config.get<string>('asaas.apiBaseUrl') ?? 'https://api-sandbox.asaas.com/v3'
    ).replace(/\/$/, '');
    const timeout = this.config.get<number>('asaas.httpTimeoutMs') ?? 15_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          access_token: apiKey,
          'User-Agent': 'Prospectly/0.1',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          Accept: 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
    } catch {
      this.logger.error(`Asaas network failure on ${path}`);
      throw new AsaasRequestError(method === 'POST');
    } finally {
      clearTimeout(timer);
    }

    const json = (await response.json().catch(() => null)) as unknown;
    if (response.ok && json) {
      return json;
    }
    if (response.ok) {
      this.logger.warn(`Asaas HTTP ${response.status} on ${path}`);
      throw new AsaasRequestError(method === 'POST');
    }
    this.throwForFailedResponse(method, path, response.status, json);
  }

  private throwForFailedResponse(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    status: number,
    json: unknown,
  ): never {
    const descriptions = readAsaasErrorDescriptions(json);
    this.logger.warn(
      `Asaas HTTP ${status} on ${path}${descriptions.length ? `: ${descriptions.join('; ')}` : ''}`,
    );

    if (status === 400) {
      throw new BadRequestException(
        descriptions.length > 0
          ? descriptions.join(' ')
          : 'Não foi possível validar os dados de cobrança. Verifique CPF/CNPJ, telefone e e-mail.',
      );
    }

    if (status === 401 || status === 403) {
      throw new AsaasRequestError(false, status, 'Card payments are temporarily unavailable');
    }

    throw new AsaasRequestError(method === 'POST' && status >= 500, status);
  }
}

function asaasCustomerBody(
  input: Pick<AsaasCustomerInput, 'name' | 'cpfCnpj' | 'phone' | 'email'>,
) {
  return {
    name: input.name,
    cpfCnpj: input.cpfCnpj,
    email: input.email,
    notificationDisabled: true,
    ...asaasPhoneFields(input.phone),
  };
}

function asaasPhoneFields(phone: string): { phone?: string; mobilePhone?: string } {
  const subscriber = phone.slice(2);
  if (phone.length === 11 || subscriber.startsWith('9')) {
    return { mobilePhone: phone };
  }
  return { phone };
}

function isMissingAsaasCustomer(error: unknown): boolean {
  return error instanceof AsaasRequestError && error.httpStatus === 404;
}

function readAsaasErrorDescriptions(value: unknown): string[] {
  return readArray(value, 'errors').flatMap((item) => {
    const description = readString(item, 'description');
    return description ? [description] : [];
  });
}

function readString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' && field.length > 0 ? field : undefined;
}

function readNumber(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'number' && Number.isFinite(field) ? field : undefined;
}

function readBoolean(value: unknown, key: string): boolean | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'boolean' ? field : undefined;
}

function readArray(value: unknown, key: string): unknown[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const field = (value as Record<string, unknown>)[key];
  return Array.isArray(field) ? field : [];
}

function readNestedString(value: unknown, parent: string, key: string): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const nested = (value as Record<string, unknown>)[parent];
  return readString(nested, key);
}

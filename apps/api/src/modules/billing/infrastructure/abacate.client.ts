import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type JsonRecord = Record<string, unknown>;

type AbacateEnvelope = {
  data?: unknown;
  success?: unknown;
  error?: string | null;
};

export type AbacateTransparentCharge = {
  id: string;
  amount: number;
  status?: string;
  brCode: string;
  brCodeBase64: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AbacateHostedCheckout = {
  id: string;
  url: string;
  customerId?: string | null;
  status?: string;
  externalId?: string | null;
  metadata?: Record<string, unknown> | null;
};

const DEFAULT_TIMEOUT_MS = 15_000;

@Injectable()
export class AbacateClient {
  private readonly logger = new Logger(AbacateClient.name);

  constructor(private readonly config: ConfigService) {}

  private requireApiKey(): string {
    const key = this.config.get<string>('abacate.apiKey');
    if (!key) {
      throw new ServiceUnavailableException('AbacatePay is not configured');
    }
    return key;
  }

  private baseUrl(): string {
    return (
      this.config.get<string>('abacate.apiBaseUrl') ?? 'https://api.abacatepay.com/v2'
    ).replace(/\/$/, '');
  }

  private timeoutMs(): number {
    const configured = this.config.get<number>('abacate.httpTimeoutMs');
    if (typeof configured === 'number' && Number.isInteger(configured) && configured > 0) {
      return configured;
    }
    return DEFAULT_TIMEOUT_MS;
  }

  async createTransparentPix(input: {
    amountCentavos: number;
    description: string;
    externalId: string;
    metadata: Record<string, string>;
    expiresInSeconds?: number;
  }): Promise<AbacateTransparentCharge> {
    const data = await this.post('/transparents/create', {
      method: 'PIX',
      data: {
        amount: input.amountCentavos,
        description: input.description,
        expiresIn: input.expiresInSeconds ?? 3600,
        externalId: input.externalId,
        metadata: input.metadata,
      },
    });
    return this.requireTransparentCharge(data);
  }

  async createOneTimeCheckout(input: {
    productId: string;
    returnUrl: string;
    completionUrl: string;
    externalId: string;
    metadata: Record<string, string>;
    customerId?: string | null;
  }): Promise<AbacateHostedCheckout> {
    const data = await this.post('/checkouts/create', {
      items: [{ id: input.productId, quantity: 1 }],
      methods: ['CARD'],
      returnUrl: input.returnUrl,
      completionUrl: input.completionUrl,
      externalId: input.externalId,
      metadata: input.metadata,
      ...(input.customerId ? { customerId: input.customerId } : {}),
    });
    return this.requireHostedCheckout(data);
  }

  async createSubscriptionCheckout(input: {
    productId: string;
    returnUrl: string;
    completionUrl: string;
    externalId: string;
    metadata: Record<string, string>;
    customerId?: string | null;
  }): Promise<AbacateHostedCheckout> {
    const data = await this.post('/subscriptions/create', {
      items: [{ id: input.productId, quantity: 1 }],
      methods: ['CARD'],
      returnUrl: input.returnUrl,
      completionUrl: input.completionUrl,
      externalId: input.externalId,
      metadata: input.metadata,
      ...(input.customerId ? { customerId: input.customerId } : {}),
    });
    return this.requireHostedCheckout(data);
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.post('/subscriptions/cancel', { id: subscriptionId });
  }

  private requireTransparentCharge(data: unknown): AbacateTransparentCharge {
    const record = asRecord(data);
    const id = readString(record, 'id');
    const brCode = readString(record, 'brCode');
    const brCodeBase64 = readString(record, 'brCodeBase64');
    if (!id || !brCode || !brCodeBase64) {
      this.logger.warn('AbacatePay transparent response missing id or PIX codes');
      throw new ServiceUnavailableException('AbacatePay request failed');
    }
    const amount = readNumber(record, 'amount') ?? 0;
    return {
      id,
      amount,
      status: readString(record, 'status'),
      brCode,
      brCodeBase64,
      expiresAt: readString(record, 'expiresAt'),
      metadata: record?.metadata && typeof record.metadata === 'object' ? (record.metadata as Record<string, unknown>) : null,
    };
  }

  private requireHostedCheckout(data: unknown): AbacateHostedCheckout {
    const record = asRecord(data);
    const id = readString(record, 'id');
    const url = readString(record, 'url');
    if (!id || !url) {
      this.logger.warn('AbacatePay hosted checkout missing id or url');
      throw new ServiceUnavailableException('AbacatePay request failed');
    }
    return {
      id,
      url,
      customerId: readString(record, 'customerId'),
      status: readString(record, 'status'),
      externalId: readString(record, 'externalId'),
    };
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const apiKey = this.requireApiKey();
    const url = `${this.baseUrl()}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs());

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      this.logger.error(`AbacatePay ${aborted ? 'timeout' : 'network'} failure on ${path}`);
      throw new ServiceUnavailableException('AbacatePay request failed');
    } finally {
      clearTimeout(timer);
    }

    const json = (await response.json().catch(() => null)) as AbacateEnvelope | null;
    if (!response.ok || !json || json.error || json.data === undefined || json.data === null) {
      this.logger.warn(`AbacatePay HTTP ${response.status} on ${path}`);
      throw new ServiceUnavailableException('AbacatePay request failed');
    }

    return json.data;
  }
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function readString(record: JsonRecord | null, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(record: JsonRecord | null, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

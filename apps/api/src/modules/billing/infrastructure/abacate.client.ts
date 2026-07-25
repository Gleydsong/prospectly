import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type AbacateEnvelope<T> = {
  data: T;
  success?: boolean | { message?: string };
  error: string | null;
};

export type AbacateTransparentCharge = {
  id: string;
  amount: number;
  status: string;
  brCode: string;
  brCodeBase64: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AbacateSubscriptionCheckout = {
  id: string;
  url: string;
  customerId?: string | null;
  status?: string;
  metadata?: Record<string, unknown> | null;
};

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

  async createTransparentPix(input: {
    amountCentavos: number;
    description: string;
    externalId: string;
    metadata: Record<string, string>;
    expiresInSeconds?: number;
  }): Promise<AbacateTransparentCharge> {
    return this.post<AbacateTransparentCharge>('/transparents/create', {
      method: 'PIX',
      data: {
        amount: input.amountCentavos,
        description: input.description,
        expiresIn: input.expiresInSeconds ?? 3600,
        externalId: input.externalId,
        metadata: input.metadata,
      },
    });
  }

  async createSubscriptionCheckout(input: {
    productId: string;
    returnUrl: string;
    completionUrl: string;
    externalId: string;
    metadata: Record<string, string>;
    customerId?: string | null;
  }): Promise<AbacateSubscriptionCheckout> {
    return this.post<AbacateSubscriptionCheckout>('/subscriptions/create', {
      items: [{ id: input.productId, quantity: 1 }],
      methods: ['CARD'],
      returnUrl: input.returnUrl,
      completionUrl: input.completionUrl,
      externalId: input.externalId,
      metadata: input.metadata,
      ...(input.customerId ? { customerId: input.customerId } : {}),
    });
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.post('/subscriptions/cancel', { id: subscriptionId });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const apiKey = this.requireApiKey();
    const url = `${this.baseUrl()}${path}`;

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
      });
    } catch (error) {
      this.logger.error(`AbacatePay request failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException('AbacatePay request failed');
    }

    const json = (await response.json().catch(() => null)) as AbacateEnvelope<T> | null;
    if (!response.ok || !json || json.error || !json.data) {
      const message = json?.error ?? `AbacatePay HTTP ${response.status}`;
      this.logger.warn(`AbacatePay error on ${path}: ${message}`);
      throw new ServiceUnavailableException(message);
    }

    return json.data;
  }
}

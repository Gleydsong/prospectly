import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type HttpMethod = 'GET' | 'POST' | 'PATCH';

export class AppmaxRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly ambiguous: boolean,
  ) {
    super(message);
    this.name = 'AppmaxRequestError';
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function unwrapData(value: unknown): Record<string, unknown> {
  const root = asRecord(value);
  const data = asRecord(root.data);
  return Object.keys(data).length > 0 ? data : root;
}

@Injectable()
export class AppmaxClient {
  private accessToken: { value: string; expiresAt: number } | null = null;
  private tokenRequest: Promise<string> | null = null;
  private rateGate: Promise<void> = Promise.resolve();
  private nextRequestAt = 0;

  constructor(private readonly config: ConfigService) {}

  getExternalId(): string {
    return this.requireConfig('appmax.externalId', 'APPMAX_EXTERNAL_ID');
  }

  async createCustomer(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return unwrapData(await this.request('POST', '/v1/customers', input));
  }

  async createOrder(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return unwrapData(await this.request('POST', '/v1/orders', input));
  }

  async payCreditCard(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return unwrapData(await this.request('POST', '/v1/payments/credit-card', input));
  }

  async getOrder(orderId: string): Promise<Record<string, unknown>> {
    return unwrapData(await this.request('GET', `/v1/orders/${encodeURIComponent(orderId)}`));
  }

  async createSubscription(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return unwrapData(await this.request('POST', '/v1/subscriptions', input));
  }

  async listSubscriptions(email: string): Promise<Record<string, unknown>> {
    return unwrapData(
      await this.request('GET', `/v1/subscriptions?email=${encodeURIComponent(email)}`),
    );
  }

  async getSubscription(subscriptionId: string): Promise<Record<string, unknown>> {
    return unwrapData(
      await this.request('GET', `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`),
    );
  }

  async cancelSubscription(subscriptionId: string): Promise<Record<string, unknown>> {
    return unwrapData(
      await this.request(
        'PATCH',
        `/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
        {},
      ),
    );
  }

  private async request(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    retriedAuth = false,
  ): Promise<unknown> {
    const token = await this.getAccessToken();
    await this.waitForRateSlot();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs());
    let response: Response;
    try {
      response = await fetch(`${this.apiBaseUrl()}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
    } catch (error) {
      throw new AppmaxRequestError(
        error instanceof Error ? `Appmax request failed: ${error.name}` : 'Appmax request failed',
        null,
        method !== 'GET',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 && !retriedAuth) {
      this.accessToken = null;
      return this.request(method, path, body, true);
    }

    const payload = await this.readResponse(response);
    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after');
      const suffix = retryAfter ? `; retry-after=${retryAfter}` : '';
      throw new AppmaxRequestError(
        `Appmax ${method} ${path} returned ${response.status}${suffix}`,
        response.status,
        method !== 'GET' && response.status >= 500,
      );
    }
    return payload;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) {
      return this.accessToken.value;
    }
    if (this.tokenRequest) return this.tokenRequest;

    this.tokenRequest = this.fetchAccessToken();
    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = null;
    }
  }

  private async fetchAccessToken(): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.requireConfig('appmax.clientId', 'APPMAX_CLIENT_ID'),
        client_secret: this.requireConfig('appmax.clientSecret', 'APPMAX_CLIENT_SECRET'),
      });
      const response = await fetch(`${this.authBaseUrl()}/oauth2/token`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: controller.signal,
      });
      const payload = asRecord(await this.readResponse(response));
      const token = typeof payload.access_token === 'string' ? payload.access_token : null;
      if (!response.ok || !token) {
        throw new ServiceUnavailableException(`Appmax OAuth returned ${response.status}`);
      }
      const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 3600;
      this.accessToken = { value: token, expiresAt: Date.now() + expiresIn * 1000 };
      return token;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Appmax OAuth is unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readResponse(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new AppmaxRequestError(
        `Appmax returned invalid JSON (${response.status})`,
        response.status,
        false,
      );
    }
  }

  private async waitForRateSlot(): Promise<void> {
    const turn = this.rateGate.then(async () => {
      const delayMs = Math.max(0, this.nextRequestAt - Date.now());
      if (delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
      // Official sustained limit is 5 merchant API requests per second.
      this.nextRequestAt = Date.now() + 200;
    });
    this.rateGate = turn.catch(() => undefined);
    await turn;
  }

  private requireConfig(key: string, envName: string): string {
    const value = this.config.get<string>(key)?.trim();
    if (!value) throw new ServiceUnavailableException(`${envName} is not configured`);
    return value;
  }

  private timeoutMs(): number {
    return this.config.get<number>('appmax.httpTimeoutMs') ?? 12_000;
  }

  private apiBaseUrl(): string {
    return (this.config.get<string>('appmax.apiBaseUrl') ?? '').replace(/\/$/, '');
  }

  private authBaseUrl(): string {
    return (this.config.get<string>('appmax.authBaseUrl') ?? '').replace(/\/$/, '');
  }
}

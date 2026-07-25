export type PaymentProviderId = 'STRIPE' | 'ABACATE';

export type BillingCurrency = 'BRL' | 'EUR' | 'USD';
export type BillingInterval = 'monthly' | 'lifetime';

export type CheckoutRequest = {
  organizationId: string;
  customerEmail: string;
  customerName?: string;
  interval: BillingInterval;
  currency: BillingCurrency;
  successUrl: string;
  cancelUrl: string;
  existingCustomerId?: string | null;
};

/** Resposta discriminada: redirect (Stripe / assinatura BR) ou PIX in-app (vitalício BR). */
export type CheckoutResult =
  | {
      mode: 'redirect';
      url: string;
      provider: PaymentProviderId;
      externalCustomerId?: string;
      externalCheckoutId?: string;
    }
  | {
      mode: 'pix';
      provider: 'ABACATE';
      brCode: string;
      brCodeBase64: string;
      externalPaymentId: string;
      amountCentavos: number;
      expiresAt?: string;
    };

export type ParsedWebhookEvent = {
  eventId: string;
  type: string;
  payload: unknown;
};

export type WebhookApplyResult = {
  handled: boolean;
  eventId: string;
  type: string;
};

export interface PaymentProviderAdapter {
  readonly id: PaymentProviderId;
  createCheckout(input: CheckoutRequest): Promise<CheckoutResult>;
  createPortal?(input: {
    organizationId: string;
    externalCustomerId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;
  cancelSubscription?(input: {
    organizationId: string;
    externalSubscriptionId: string;
  }): Promise<void>;
  verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    query?: Record<string, string | string[] | undefined>,
  ): Promise<ParsedWebhookEvent>;
  applyWebhookEvent(payload: unknown, type: string): Promise<WebhookApplyResult>;
}

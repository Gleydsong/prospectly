export type PaymentProviderId = 'ABACATE';

/** Brazil-only billing currency. */
export type BillingCurrency = 'BRL';
export type PaymentMethod = 'pix' | 'card';
export type BillingInterval = 'monthly' | 'lifetime';
export type CreditOffer = 'credits-2000' | 'credits-5000';

export type CreditCheckoutRequest = {
  organizationId: string;
  offer: CreditOffer;
  paymentMethod: PaymentMethod;
  successUrl: string;
  cancelUrl: string;
  purchaseId: string;
  externalId: string;
};

export type CheckoutRequest = {
  organizationId: string;
  customerEmail: string;
  customerName?: string;
  interval: BillingInterval;
  currency: BillingCurrency;
  paymentMethod: PaymentMethod;
  successUrl: string;
  cancelUrl: string;
  existingCustomerId?: string | null;
  /** Stable application id used to recover a recurring checkout after a lost response. */
  externalId?: string;
};

/** Resposta discriminada: redirect (checkout hospedado) ou PIX in-app. */
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
  createCreditCheckout?(input: CreditCheckoutRequest): Promise<CheckoutResult>;
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

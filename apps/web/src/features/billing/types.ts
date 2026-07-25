export type CheckoutResult =
  | {
      mode: 'redirect';
      url: string;
      provider: 'STRIPE' | 'ABACATE';
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

export type BillingStatus = {
  plan: string;
  planStatus: string;
  planCurrency: string | null;
  paymentProvider: 'STRIPE' | 'ABACATE' | null;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
  canOpenPortal: boolean;
  canCancelSubscription: boolean;
  freeSearchLimit: number;
};

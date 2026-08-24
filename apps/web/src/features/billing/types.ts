export type CheckoutResult =
  | {
      mode: 'redirect';
      url: string;
      provider: 'ABACATE';
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

export type SearchUsage = {
  used: number;
  /** null when the active plan has no search cap. */
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
};

export type CreditOffer = 'credits-2000' | 'credits-5000';

export type BillingStatus = {
  searchUsage: SearchUsage;
  plan: string;
  planStatus: string;
  planCurrency: string | null;
  paymentProvider: 'STRIPE' | 'ABACATE' | null;
  currentPeriodEnd: string | null;
  canCancelSubscription: boolean;
  canExportCsv: boolean;
  freeSearchLimit: number;
  creditBalance: number;
};

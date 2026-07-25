import type { BillingCurrency, PaymentProviderId } from './payment-provider';

export function resolvePaymentProviderId(currency: BillingCurrency): PaymentProviderId {
  if (currency === 'BRL') return 'ABACATE';
  return 'STRIPE';
}

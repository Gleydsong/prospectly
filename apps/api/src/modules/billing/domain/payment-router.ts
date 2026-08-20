import type { PaymentMethod, PaymentProviderId } from './payment-provider';

/** New sales (PIX and card) always go through AbacatePay. Stripe is legacy-only. */
export function resolvePaymentProviderId(_method: PaymentMethod): PaymentProviderId {
  return 'ABACATE';
}

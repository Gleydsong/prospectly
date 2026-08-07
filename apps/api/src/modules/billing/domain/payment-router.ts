import type { PaymentMethod, PaymentProviderId } from './payment-provider';

/** Brazil-only routing: PIX → Abacate, card → Stripe. */
export function resolvePaymentProviderId(method: PaymentMethod): PaymentProviderId {
  return method === 'pix' ? 'ABACATE' : 'STRIPE';
}

import type { PaymentMethod, PaymentProviderId } from './payment-provider';

/** PIX stays on AbacatePay. Card checkout has no configured provider yet. */
export function resolvePaymentProviderId(method: PaymentMethod): PaymentProviderId {
  if (method === 'pix') return 'ABACATE';
  throw new Error('Card payment provider is not configured');
}

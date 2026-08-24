import type { PaymentMethod, PaymentProviderId } from './payment-provider';

/** PIX stays on AbacatePay; cards are tokenized and charged by Appmax. */
export function resolvePaymentProviderId(method: PaymentMethod): PaymentProviderId {
  return method === 'pix' ? 'ABACATE' : 'APPMAX';
}

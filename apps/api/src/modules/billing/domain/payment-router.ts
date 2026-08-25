import type { PaymentMethod, PaymentProviderId } from './payment-provider';

/** PIX stays on AbacatePay while hosted card checkout is owned by Asaas. */
export function resolvePaymentProviderId(method: PaymentMethod): PaymentProviderId {
  if (method === 'pix') return 'ABACATE';
  return 'ASAAS';
}

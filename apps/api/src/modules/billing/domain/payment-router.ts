import type { PaymentMethod, PaymentProviderId, PixProviderId } from './payment-provider';

/** Cards stay on Asaas. New PIX follows PIX_PROVIDER; cutover default is ASAAS. */
export function resolvePaymentProviderId(
  method: PaymentMethod,
  pixProvider: PixProviderId,
): PaymentProviderId | 'DISABLED' {
  if (method === 'pix') return pixProvider;
  return 'ASAAS';
}

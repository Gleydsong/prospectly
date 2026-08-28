import type { PaymentMethod, PaymentProviderId, PixProviderId } from './payment-provider';

/** Cards stay on Asaas while PIX routing is an explicit operational decision. */
export function resolvePaymentProviderId(
  method: PaymentMethod,
  pixProvider: PixProviderId,
): PaymentProviderId | 'DISABLED' {
  if (method === 'pix') return pixProvider;
  return 'ASAAS';
}

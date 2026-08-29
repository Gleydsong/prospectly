import type { AsaasPayment } from '../infrastructure/asaas.client';

export function asaasPaymentGrantsBenefit(payment: AsaasPayment, isPix: boolean): boolean {
  if (payment.deleted === true) return false;
  if (isPix) return payment.status === 'RECEIVED';
  return payment.status === 'CONFIRMED' || payment.status === 'RECEIVED';
}

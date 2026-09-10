import type { BillingStatus } from './types';
import type { CheckoutIntent } from './checkout-intent';

export const CREDITS_BY_OFFER: Record<'credits-2000' | 'credits-5000', number> = {
  'credits-2000': 2000,
  'credits-5000': 5000,
};

export const CREDITS_BY_AMOUNT: Record<number, number> = {
  1499: 2000,
  2399: 5000,
};

export function isPlanConfirmed(
  status: Pick<BillingStatus, 'plan' | 'planStatus' | 'paymentProvider'>,
  expectedProvider?: 'ASAAS',
): boolean {
  if (status.plan !== 'STARTER_MONTHLY' || status.planStatus !== 'ACTIVE') {
    return false;
  }
  if (expectedProvider) {
    return status.paymentProvider === expectedProvider;
  }
  return status.paymentProvider === 'ASAAS';
}

export function isCreditsConfirmed(
  intent: Pick<CheckoutIntent, 'offer' | 'baselineCreditBalance'>,
  status: Pick<BillingStatus, 'creditBalance'>,
  amountCentavos?: number,
): boolean {
  const expected =
    (intent.offer ? CREDITS_BY_OFFER[intent.offer] : undefined) ??
    (typeof amountCentavos === 'number' ? CREDITS_BY_AMOUNT[amountCentavos] : undefined);
  if (!expected || typeof intent.baselineCreditBalance !== 'number') return false;
  return status.creditBalance >= intent.baselineCreditBalance + expected;
}

export function isCheckoutConfirmed(intent: CheckoutIntent, status: BillingStatus): boolean {
  if (intent.purpose === 'plan') return isPlanConfirmed(status, intent.provider);
  return isCreditsConfirmed(intent, status);
}

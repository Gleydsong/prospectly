import type { CreditOffer } from './domain/payment-provider';

export const CREDIT_PACKAGES: Record<CreditOffer, { credits: number; amountCentavos: number }> = {
  'credits-2000': { credits: 2000, amountCentavos: 1499 },
  'credits-5000': { credits: 5000, amountCentavos: 2399 },
};

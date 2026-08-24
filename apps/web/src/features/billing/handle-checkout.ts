import type { CheckoutResult } from '@/features/billing/types';
import { assignCheckoutRedirect } from '@/lib/safe-url';

import { saveCheckoutIntent } from './checkout-intent';

export type PixCheckoutMeta = {
  purpose?: 'credits' | 'plan';
  offer?: 'credits-2000' | 'credits-5000';
  plan?: 'monthly';
  baselineCreditBalance?: number;
};

/** Handles checkout API result: PIX in-app or hosted redirect. */
export function handleCheckoutResult(result: CheckoutResult, meta?: PixCheckoutMeta): void {
  if (result.mode === 'pix') {
    sessionStorage.setItem('prospectly.pixCheckout', JSON.stringify({ ...result, ...meta }));
    window.location.assign('/billing/pix');
    return;
  }
  if (result.mode === 'pending') {
    saveCheckoutIntent({
      purpose: meta?.purpose ?? 'plan',
      offer: meta?.offer,
      plan: meta?.plan ?? (meta?.purpose === 'credits' ? undefined : 'monthly'),
      baselineCreditBalance: meta?.baselineCreditBalance,
      provider: result.provider,
      externalCheckoutId: result.externalOrderId,
    });
    window.location.assign('/billing/success');
    return;
  }
  saveCheckoutIntent({
    purpose: meta?.purpose ?? 'plan',
    offer: meta?.offer,
    plan: meta?.plan ?? (meta?.purpose === 'credits' ? undefined : 'monthly'),
    baselineCreditBalance: meta?.baselineCreditBalance,
    provider: result.provider,
    externalCheckoutId: result.externalCheckoutId,
  });
  assignCheckoutRedirect(result.url, result.provider);
}

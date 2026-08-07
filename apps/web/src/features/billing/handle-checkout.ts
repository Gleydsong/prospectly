import type { CheckoutResult } from '@/features/billing/types';
import { assignCheckoutRedirect } from '@/lib/safe-url';

export type PixCheckoutMeta = {
  purpose?: 'credits' | 'plan';
  baselineCreditBalance?: number;
};

/** Handles checkout API result: PIX in-app or hosted redirect. */
export function handleCheckoutResult(result: CheckoutResult, meta?: PixCheckoutMeta): void {
  if (result.mode === 'pix') {
    sessionStorage.setItem('prospectly.pixCheckout', JSON.stringify({ ...result, ...meta }));
    window.location.assign('/billing/pix');
    return;
  }
  assignCheckoutRedirect(result.url, result.provider);
}

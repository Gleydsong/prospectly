import type { CheckoutResult } from '@/features/billing/types';
import { assignCheckoutRedirect } from '@/lib/safe-url';

/** Handles checkout API result: PIX in-app or hosted redirect. */
export function handleCheckoutResult(result: CheckoutResult): void {
  if (result.mode === 'pix') {
    sessionStorage.setItem('prospectly.pixCheckout', JSON.stringify(result));
    window.location.assign('/billing/pix');
    return;
  }
  assignCheckoutRedirect(result.url, result.provider);
}

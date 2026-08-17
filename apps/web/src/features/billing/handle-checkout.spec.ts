import { describe, expect, it, vi } from 'vitest';

import { handleCheckoutResult } from './handle-checkout';
import { readCheckoutIntent } from './checkout-intent';

const assignCheckoutRedirect = vi.fn();

vi.mock('@/lib/safe-url', () => ({
  assignCheckoutRedirect: (...args: unknown[]) => assignCheckoutRedirect(...args),
}));

describe('handleCheckoutResult', () => {
  it('saves Abacate card redirect intent and calls the host allowlist', () => {
    sessionStorage.clear();
    handleCheckoutResult(
      {
        mode: 'redirect',
        provider: 'ABACATE',
        url: 'https://app.abacatepay.com/pay/bill_1',
        externalCheckoutId: 'bill_1',
      },
      { purpose: 'credits', offer: 'credits-2000', baselineCreditBalance: 400 },
    );
    expect(assignCheckoutRedirect).toHaveBeenCalledWith(
      'https://app.abacatepay.com/pay/bill_1',
      'ABACATE',
    );
    expect(readCheckoutIntent()).toEqual(
      expect.objectContaining({
        purpose: 'credits',
        offer: 'credits-2000',
        provider: 'ABACATE',
        externalCheckoutId: 'bill_1',
      }),
    );
  });
});

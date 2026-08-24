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

  it('stores an Appmax pending order and opens the confirmation poll page', () => {
    sessionStorage.clear();
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    handleCheckoutResult(
      { mode: 'pending', provider: 'APPMAX', externalOrderId: '12345', status: 'PAYMENT_PENDING' },
      { purpose: 'credits', offer: 'credits-5000', baselineCreditBalance: 400 },
    );
    expect(readCheckoutIntent()).toEqual(
      expect.objectContaining({ provider: 'APPMAX', externalCheckoutId: '12345' }),
    );
    expect(assign).toHaveBeenCalledWith('/billing/success');
    vi.unstubAllGlobals();
  });
});

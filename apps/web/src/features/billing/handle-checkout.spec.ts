import { describe, expect, it, vi } from 'vitest';

import { handleCheckoutResult } from './handle-checkout';
import { readCheckoutIntent } from './checkout-intent';

const assignCheckoutRedirect = vi.fn();

vi.mock('@/lib/safe-url', () => ({
  assignCheckoutRedirect: (...args: unknown[]) => assignCheckoutRedirect(...args),
}));

describe('handleCheckoutResult', () => {
  it('stores an Asaas PIX checkout for the in-app QR page', () => {
    sessionStorage.clear();
    const navigationError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    handleCheckoutResult(
      {
        mode: 'pix',
        provider: 'ASAAS',
        brCode: 'pix-copy-and-paste',
        brCodeBase64: 'base64-image',
        amountCentavos: 1499,
        externalPaymentId: 'pay_pix_1',
      },
      { purpose: 'credits', offer: 'credits-2000', baselineCreditBalance: 400 },
    );

    expect(JSON.parse(sessionStorage.getItem('prospectly.pixCheckout') ?? 'null')).toEqual(
      expect.objectContaining({
        provider: 'ASAAS',
        brCode: 'pix-copy-and-paste',
        externalPaymentId: 'pay_pix_1',
        purpose: 'credits',
      }),
    );
    navigationError.mockRestore();
  });

  it('saves Asaas card redirect intent and calls the host allowlist', () => {
    sessionStorage.clear();
    handleCheckoutResult(
      {
        mode: 'redirect',
        provider: 'ASAAS',
        url: 'https://sandbox.asaas.com/i/bill_1',
        externalCheckoutId: 'bill_1',
      },
      { purpose: 'credits', offer: 'credits-2000', baselineCreditBalance: 400 },
    );
    expect(assignCheckoutRedirect).toHaveBeenCalledWith(
      'https://sandbox.asaas.com/i/bill_1',
      'ASAAS',
    );
    expect(readCheckoutIntent()).toEqual(
      expect.objectContaining({
        purpose: 'credits',
        offer: 'credits-2000',
        provider: 'ASAAS',
        externalCheckoutId: 'bill_1',
      }),
    );
  });
});

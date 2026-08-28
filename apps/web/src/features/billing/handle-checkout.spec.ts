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

    handleCheckoutResult(
      {
        mode: 'pix',
        provider: 'ASAAS',
        qrCode: 'pix-copy-and-paste',
        qrCodeBase64: 'base64-image',
        amount: 14.99,
        externalCheckoutId: 'pay_pix_1',
      },
      { purpose: 'credits', offer: 'credits-2000', baselineCreditBalance: 400 },
    );

    expect(JSON.parse(sessionStorage.getItem('prospectly.pixCheckout') ?? 'null')).toEqual(
      expect.objectContaining({
        provider: 'ASAAS',
        qrCode: 'pix-copy-and-paste',
        externalCheckoutId: 'pay_pix_1',
        purpose: 'credits',
      }),
    );
  });

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

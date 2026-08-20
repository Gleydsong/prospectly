import { resolvePaymentProviderId } from './payment-router';

describe('resolvePaymentProviderId', () => {
  it('routes pix to ABACATE', () => {
    expect(resolvePaymentProviderId('pix')).toBe('ABACATE');
  });

  it('routes card to ABACATE', () => {
    expect(resolvePaymentProviderId('card')).toBe('ABACATE');
  });
});

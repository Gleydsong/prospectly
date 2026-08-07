import { resolvePaymentProviderId } from './payment-router';

describe('resolvePaymentProviderId', () => {
  it('routes pix to ABACATE', () => {
    expect(resolvePaymentProviderId('pix')).toBe('ABACATE');
  });

  it('routes card to STRIPE', () => {
    expect(resolvePaymentProviderId('card')).toBe('STRIPE');
  });
});

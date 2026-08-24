import { resolvePaymentProviderId } from './payment-router';

describe('resolvePaymentProviderId', () => {
  it('routes pix to ABACATE', () => {
    expect(resolvePaymentProviderId('pix')).toBe('ABACATE');
  });

  it('rejects card while no provider is configured', () => {
    expect(() => resolvePaymentProviderId('card')).toThrow(
      'Card payment provider is not configured',
    );
  });
});

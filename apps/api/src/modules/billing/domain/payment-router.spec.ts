import { resolvePaymentProviderId } from './payment-router';

describe('resolvePaymentProviderId', () => {
  it('routes BRL to ABACATE', () => {
    expect(resolvePaymentProviderId('BRL')).toBe('ABACATE');
  });

  it('routes EUR to STRIPE', () => {
    expect(resolvePaymentProviderId('EUR')).toBe('STRIPE');
  });

  it('routes USD to STRIPE', () => {
    expect(resolvePaymentProviderId('USD')).toBe('STRIPE');
  });
});

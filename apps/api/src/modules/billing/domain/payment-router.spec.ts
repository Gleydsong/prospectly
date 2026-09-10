import { resolvePaymentProviderId } from './payment-router';

describe('resolvePaymentProviderId', () => {
  it('routes pix to the explicitly configured provider', () => {
    expect(resolvePaymentProviderId('pix', 'ASAAS')).toBe('ASAAS');
    expect(resolvePaymentProviderId('pix', 'DISABLED')).toBe('DISABLED');
  });

  it('keeps card on ASAAS independently from pix routing', () => {
    expect(resolvePaymentProviderId('card', 'DISABLED')).toBe('ASAAS');
  });
});

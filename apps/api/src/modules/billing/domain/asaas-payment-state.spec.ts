import { asaasPaymentGrantsBenefit } from './asaas-payment-state';

describe('asaasPaymentGrantsBenefit', () => {
  it('grants PIX only after RECEIVED', () => {
    expect(asaasPaymentGrantsBenefit({ id: 'pay_1', status: 'CONFIRMED' }, true)).toBe(false);
    expect(asaasPaymentGrantsBenefit({ id: 'pay_1', status: 'RECEIVED' }, true)).toBe(true);
  });

  it('grants card after CONFIRMED or RECEIVED', () => {
    expect(asaasPaymentGrantsBenefit({ id: 'pay_1', status: 'CONFIRMED' }, false)).toBe(true);
    expect(asaasPaymentGrantsBenefit({ id: 'pay_1', status: 'RECEIVED' }, false)).toBe(true);
    expect(asaasPaymentGrantsBenefit({ id: 'pay_1', status: 'PENDING' }, false)).toBe(false);
  });

  it('never grants a deleted payment', () => {
    expect(
      asaasPaymentGrantsBenefit({ id: 'pay_1', status: 'RECEIVED', deleted: true }, true),
    ).toBe(false);
  });
});

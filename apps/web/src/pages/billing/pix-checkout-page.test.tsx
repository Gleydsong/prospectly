import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { PixCheckoutPage } from './pix-checkout-page';

const getBillingStatus = vi.fn();
const createCreditCheckout = vi.fn();

vi.mock('@/features/billing/api', () => ({
  getBillingStatus: (...args: unknown[]) => getBillingStatus(...args),
}));

vi.mock('@/features/auth/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth/api')>('@/features/auth/api');
  return {
    ...actual,
    createCreditCheckout: (...args: unknown[]) => createCreditCheckout(...args),
  };
});

describe('PixCheckoutPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    createCreditCheckout.mockReset();
    getBillingStatus.mockResolvedValue({
      plan: 'FREE',
      planStatus: 'INACTIVE',
      creditBalance: 400,
    });
    sessionStorage.setItem(
      'prospectly.pixCheckout',
      JSON.stringify({
        mode: 'pix',
        provider: 'ASAAS',
        brCode: '000201',
        brCodeBase64: 'cG5n',
        externalPaymentId: 'pay_pix_1',
        amountCentavos: 1499,
        purpose: 'credits',
        offer: 'credits-2000',
        baselineCreditBalance: 400,
      }),
    );
  });

  it('does not start another checkout when the payer goes back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PixCheckoutPage />, { initialEntries: ['/billing/pix'] });
    await user.click(await screen.findByRole('button', { name: 'Voltar' }));
    expect(createCreditCheckout).not.toHaveBeenCalled();
  });
});

import { AxiosError } from 'axios';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { BillingProfileForm } from './billing-profile-form';

const getBillingProfile = vi.fn();
const updateBillingProfile = vi.fn();

vi.mock('./api', () => ({
  getBillingProfile: (...args: unknown[]) => getBillingProfile(...args),
  updateBillingProfile: (...args: unknown[]) => updateBillingProfile(...args),
}));

describe('BillingProfileForm', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    getBillingProfile.mockReset();
    updateBillingProfile.mockReset();
    getBillingProfile.mockResolvedValue(null);
  });

  it('shows the Asaas validation message returned by the billing profile API', async () => {
    const user = userEvent.setup();
    const error = new AxiosError('fail');
    error.response = {
      status: 400,
      data: { message: 'O CPF informado é inválido' },
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    };
    updateBillingProfile.mockRejectedValue(error);

    renderWithProviders(<BillingProfileForm />);

    await user.type(await screen.findByLabelText(/Nome ou razão social/i), 'Acme Ltda');
    await user.type(screen.getByLabelText(/CPF ou CNPJ/i), '24971563792');
    await user.type(screen.getByLabelText(/Telefone/i), '11999999999');
    await user.type(screen.getByLabelText(/E-mail de cobrança/i), 'financeiro@acme.test');
    await user.click(screen.getByRole('button', { name: /Salvar perfil de cobrança/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('O CPF informado é inválido');
  });
});

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

async function fillRequiredProfile(
  user: ReturnType<typeof userEvent.setup>,
  overrides?: { phone?: string },
) {
  await user.type(await screen.findByLabelText(/Nome ou razão social/i), 'Acme Ltda');
  await user.type(screen.getByLabelText(/CPF ou CNPJ/i), '24971563792');
  await user.type(screen.getByLabelText(/Telefone/i), overrides?.phone ?? '11999999999');
  await user.type(screen.getByLabelText(/E-mail de cobrança/i), 'financeiro@acme.test');
  await user.type(screen.getByLabelText(/^Endereço$/i), 'Rua das Flores');
  await user.type(screen.getByLabelText(/Número do endereço/i), '100');
  await user.type(screen.getByLabelText(/Bairro/i), 'Centro');
  await user.type(screen.getByLabelText(/CEP/i), '01310100');
}

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
    await fillRequiredProfile(user);
    await user.click(screen.getByRole('button', { name: /Salvar perfil de cobrança/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('O CPF informado é inválido');
  });

  it('shows a payer-facing phone error instead of the class-validator regex', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BillingProfileForm />);

    await fillRequiredProfile(user, { phone: '1199' });
    await user.click(screen.getByRole('button', { name: /Salvar perfil de cobrança/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Informe um telefone com DDD, com 10 ou 11 dígitos.',
    );
    expect(screen.queryByText(/regular expression/i)).not.toBeInTheDocument();
    expect(updateBillingProfile).not.toHaveBeenCalled();
  });

  it('rewrites a backend phone regex error into the same payer-facing copy', async () => {
    const user = userEvent.setup();
    const error = new AxiosError('fail');
    error.response = {
      status: 400,
      data: { message: 'phone must match /^\\d{10,11}$/ regular expression' },
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    };
    updateBillingProfile.mockRejectedValue(error);

    renderWithProviders(<BillingProfileForm />);
    await fillRequiredProfile(user);
    await user.click(screen.getByRole('button', { name: /Salvar perfil de cobrança/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Informe um telefone com DDD, com 10 ou 11 dígitos.',
    );
    expect(screen.queryByText(/regular expression/i)).not.toBeInTheDocument();
  });
});

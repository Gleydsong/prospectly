import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { RegisterPage } from './register-page';

const authApiMocks = vi.hoisted(() => ({
  register: vi.fn(),
  createCheckoutSession: vi.fn(),
  createCreditCheckout: vi.fn(),
}));

vi.mock('@/features/auth/api', () => authApiMocks);
vi.mock('@/features/auth/google-sign-in-button', () => ({
  GoogleSignInButton: () => null,
}));

async function submitValidRegistration() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nome'), 'Demo User');
  await user.type(screen.getByLabelText('E-mail'), 'demo@prospectly.dev');
  await user.type(screen.getByLabelText('Senha'), 'secret12');
  await user.type(screen.getByLabelText('Nome da organização'), 'Demo Organization');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Criar conta' }));
}

describe('RegisterPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('pt');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('translates rate limited responses', async () => {
    authApiMocks.register.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        data: { code: 'RATE_LIMITED' },
        status: 429,
      },
    });
    renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });

    await submitValidRegistration();

    expect(
      await screen.findByText(
        'Muitas tentativas em pouco tempo. Aguarde cerca de um minuto e tente novamente.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a localized message when registration times out', async () => {
    authApiMocks.register.mockRejectedValueOnce({
      isAxiosError: true,
      code: 'ECONNABORTED',
      message: 'timeout of 60000ms exceeded',
    });
    renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });

    await submitValidRegistration();

    expect(
      await screen.findByText(
        'O servidor demorou mais que o esperado para responder. Tente novamente em instantes.',
      ),
    ).toBeInTheDocument();
  });
});

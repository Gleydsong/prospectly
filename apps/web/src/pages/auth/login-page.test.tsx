import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { LoginPage } from './login-page';

const authApiMocks = vi.hoisted(() => ({
  login: vi.fn(),
  createCheckoutSession: vi.fn(),
  createCreditCheckout: vi.fn(),
}));

vi.mock('@/features/auth/api', () => authApiMocks);

const renderPage = () => renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

describe('LoginPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('pt');
  });

  it('renders email and password fields', () => {
    renderPage();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Esqueci a senha' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('validates email format before submit', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('E-mail'), 'not-an-email');
    await user.type(screen.getByLabelText('Senha'), 'secret1');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('E-mail inválido')).toBeInTheDocument();
  });

  it('requires password', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('E-mail'), 'demo@prospectly.dev');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Senha obrigatória')).toBeInTheDocument();
  });

  it('shows a helpful localized message for invalid credentials', async () => {
    authApiMocks.login.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'Invalid credentials' }, status: 401 },
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('E-mail'), 'demo@prospectly.dev');
    await user.type(screen.getByLabelText('Senha'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText('E-mail ou senha inválidos. Confira os dados ou redefina sua senha.'),
    ).toBeInTheDocument();
  });

  it('prefills email from the query string', () => {
    renderWithProviders(<LoginPage />, {
      initialEntries: ['/login?email=ana%40agency.dev'],
    });
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@agency.dev');
  });

  it('preserves card method when switching to register', async () => {
    renderWithProviders(<LoginPage />, {
      initialEntries: ['/login?offer=credits-2000&method=card'],
    });
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/register?offer=credits-2000&method=card',
    );
  });
});

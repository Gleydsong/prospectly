import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { Role } from '@/types';
import { useAuthStore } from '@/stores/auth.store';
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

  beforeEach(() => {
    authApiMocks.login.mockReset();
    useAuthStore.setState({ user: null, accessToken: null, bootstrapped: false });
    localStorage.clear();
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

  it('translates rate limited responses instead of showing the raw server message', async () => {
    authApiMocks.login.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        data: {
          message: 'Too many attempts. Wait a moment and try again.',
          error: 'Too Many Requests',
          code: 'RATE_LIMITED',
        },
        status: 429,
      },
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('E-mail'), 'demo@prospectly.dev');
    await user.type(screen.getByLabelText('Senha'), 'secret1');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText(
        'Muitas tentativas em pouco tempo. Aguarde cerca de um minuto e tente novamente.',
      ),
    ).toBeInTheDocument();
  });

  it('translates an account without an active organization', async () => {
    authApiMocks.login.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        data: {
          message: 'No active organization is associated with this account',
          error: 'Unauthorized',
          code: 'NO_ORGANIZATION',
        },
        status: 401,
      },
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('E-mail'), 'demo@prospectly.dev');
    await user.type(screen.getByLabelText('Senha'), 'secret1');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText(
        'Sua conta não está vinculada a uma organização ativa. Entre em contato com o responsável pela sua equipe.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a localized message when the authentication request times out', async () => {
    authApiMocks.login.mockRejectedValueOnce({
      isAxiosError: true,
      code: 'ECONNABORTED',
      message: 'timeout of 60000ms exceeded',
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('E-mail'), 'demo@prospectly.dev');
    await user.type(screen.getByLabelText('Senha'), 'secret1');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText(
        'O servidor demorou mais que o esperado para responder. Tente novamente em instantes.',
      ),
    ).toBeInTheDocument();
  });

  it('stores the access token in memory and navigates to the app', async () => {
    authApiMocks.login.mockResolvedValueOnce({
      accessToken: 'access-token',
      user: {
        id: 'u1',
        name: 'Ana',
        email: 'ana@example.com',
        organizationId: 'org-1',
        organizationName: 'Acme',
        role: Role.OWNER,
        locale: 'pt',
      },
    });
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Dashboard autenticado</div>} />
      </Routes>,
      { initialEntries: ['/login'] },
    );

    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await user.type(screen.getByLabelText('Senha'), 'secret1');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Dashboard autenticado')).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe('access-token');
    await waitFor(() => {
      const persisted = localStorage.getItem('prospectly-auth');
      expect(persisted).toBeTruthy();
      expect(persisted).not.toContain('access-token');
    });
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

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
  const user = userEvent.setup({ delay: null });
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

  it('sends defaultPersona vendedor unless the select is changed', async () => {
    authApiMocks.register.mockResolvedValueOnce({
      accessToken: 'token',
      user: {
        id: 'u1',
        name: 'Demo User',
        email: 'demo@prospectly.dev',
        organizationId: 'org-1',
        organizationName: 'Demo Organization',
        role: 'OWNER',
        locale: 'pt',
        defaultPersona: 'vendedor',
        personaOverride: null,
        effectivePersona: 'vendedor',
        personaOnboardedAt: '2026-09-14T00:00:00.000Z',
      },
    });
    renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });

    await submitValidRegistration();

    expect(authApiMocks.register).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'demo@prospectly.dev',
        defaultPersona: 'vendedor',
        personaOtherLabel: null,
      }),
    );
  });

  it('reveals the other-label field for Outro and blocks submit without text', async () => {
    renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });
    const user = userEvent.setup({ delay: null });

    expect(screen.queryByLabelText('Como você trabalha?')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Persona profissional'), 'outro');
    expect(screen.getByLabelText('Como você trabalha?')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nome'), 'Demo User');
    await user.type(screen.getByLabelText('E-mail'), 'demo@prospectly.dev');
    await user.type(screen.getByLabelText('Senha'), 'secret12');
    await user.type(screen.getByLabelText('Nome da organização'), 'Demo Organization');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Descreva em 2 a 40 caracteres.',
    );
    expect(authApiMocks.register).not.toHaveBeenCalled();
  });

  it('sends personaOtherLabel when registering as Outro', async () => {
    authApiMocks.register.mockResolvedValueOnce({
      accessToken: 'token',
      user: {
        id: 'u1',
        name: 'Demo User',
        email: 'demo@prospectly.dev',
        organizationId: 'org-1',
        organizationName: 'Demo Organization',
        role: 'OWNER',
        locale: 'pt',
        defaultPersona: 'outro',
        personaOtherLabel: 'Fotógrafo',
        personaOverride: null,
        effectivePersona: 'outro',
        personaOnboardedAt: '2026-09-14T00:00:00.000Z',
      },
    });
    renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });
    const user = userEvent.setup({ delay: null });

    await user.type(screen.getByLabelText('Nome'), 'Demo User');
    await user.type(screen.getByLabelText('E-mail'), 'demo@prospectly.dev');
    await user.type(screen.getByLabelText('Senha'), 'secret12');
    await user.type(screen.getByLabelText('Nome da organização'), 'Demo Organization');
    await user.selectOptions(screen.getByLabelText('Persona profissional'), 'outro');
    await user.type(screen.getByLabelText('Como você trabalha?'), 'Fotógrafo');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(authApiMocks.register).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPersona: 'outro',
        personaOtherLabel: 'Fotógrafo',
      }),
    );
  });
});

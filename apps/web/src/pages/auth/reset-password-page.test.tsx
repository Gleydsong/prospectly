import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { ThemeProvider } from '@/features/theme/theme-provider';
import { ResetPasswordPage } from './reset-password-page';

const resetPassword = vi.fn().mockResolvedValue(undefined);

vi.mock('@/features/auth/api', () => ({
  resetPassword: (...args: unknown[]) => resetPassword(...args),
}));

const renderPage = (initialEntry: string) =>
  render(
    <ThemeProvider>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );

describe('ResetPasswordPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('pt');
  });

  it('shows missing token state', () => {
    renderPage('/reset-password');
    expect(
      screen.getByText(/Link inválido ou incompleto/i),
    ).toBeInTheDocument();
  });

  it('validates password strength', async () => {
    const user = userEvent.setup();
    renderPage('/reset-password?token=abc123');

    await user.type(screen.getByLabelText('Nova senha'), 'short');
    await user.type(screen.getByLabelText('Confirmar senha'), 'short');
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(await screen.findByText('Mínimo 8 caracteres')).toBeInTheDocument();
  });

  it('submits new password when token is present', async () => {
    const user = userEvent.setup();
    renderPage('/reset-password?token=abc123');

    await user.type(screen.getByLabelText('Nova senha'), 'NewPass1');
    await user.type(screen.getByLabelText('Confirmar senha'), 'NewPass1');
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(resetPassword).toHaveBeenCalledWith({
      token: 'abc123',
      newPassword: 'NewPass1',
    });
    expect(
      await screen.findByText(/Senha redefinida com sucesso/i),
    ).toBeInTheDocument();
  });
});

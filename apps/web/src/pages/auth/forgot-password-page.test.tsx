import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { ForgotPasswordPage } from './forgot-password-page';

vi.mock('@/features/auth/api', () => ({
  forgotPassword: vi.fn().mockResolvedValue({ message: 'ok' }),
}));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('ForgotPasswordPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('pt');
  });

  it('renders email field', () => {
    renderPage();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar link de redefinição' })).toBeInTheDocument();
  });

  it('validates email format before submit', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('E-mail'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }));

    expect(await screen.findByText('E-mail inválido')).toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { ThemeProvider } from '@/features/theme/theme-provider';
import { useAuthStore } from '@/stores/auth.store';
import { Role } from '@/types';
import { VerifyEmailPage } from './verify-email-page';

const mocks = vi.hoisted(() => ({
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}));

vi.mock('@/features/auth/api', () => ({
  verifyEmail: mocks.verifyEmail,
  resendVerification: mocks.resendVerification,
}));

function renderPage() {
  return render(
    <ThemeProvider>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/verify-email?token=expired-token']}>
          <VerifyEmailPage />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe('VerifyEmailPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('pt');
  });

  beforeEach(() => {
    mocks.verifyEmail.mockRejectedValue(new Error('expired'));
    mocks.resendVerification.mockReset();
    useAuthStore.setState({
      user: {
        id: 'user-1',
        name: 'Gleydson',
        email: 'gleydsong@live.com',
        organizationId: 'org-1',
        organizationName: 'Prospectly',
        role: Role.ADMIN,
        locale: 'pt',
        emailVerifiedAt: null,
      },
      accessToken: 'access-token',
    });
  });

  it('requests a new verification email instead of reloading the page', async () => {
    const user = userEvent.setup();
    mocks.resendVerification.mockResolvedValue({ message: 'ok' });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Reenviar link' }));

    expect(mocks.resendVerification).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'E-mail enviado' })).toBeInTheDocument();
  });

  it('shows the resend error without hiding the recovery action', async () => {
    const user = userEvent.setup();
    mocks.resendVerification.mockRejectedValue(new Error('mail unavailable'));
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Reenviar link' }));

    expect((await screen.findAllByRole('alert')).length).toBe(2);
    expect(screen.getByRole('button', { name: 'Reenviar link' })).toBeInTheDocument();
  });
});

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logout } from '@/features/auth/api';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import { Role } from '@/types';
import { AccountMenu } from './account-menu';

vi.mock('@/features/auth/api', () => ({ logout: vi.fn() }));

describe('Footer account menu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.setState({
      accessToken: 'token',
      bootstrapped: true,
      user: {
        id: 'u1',
        name: 'Ana',
        email: 'ana@example.com',
        organizationId: 'o1',
        organizationName: 'Org',
        role: Role.OWNER,
        locale: 'pt',
      },
    });
  });

  it('opens with the keyboard and exposes account, billing and support destinations', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderWithProviders(<AccountMenu onNavigate={onNavigate} />, { withGoogle: false });
    const summary = screen.getByRole('button', { name: 'Ana Conta e ajuda' });
    summary.focus();
    await user.keyboard('{Enter}');
    expect(summary).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Minha conta' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('link', { name: 'Créditos e plano' })).toHaveAttribute(
      'href',
      '/credits',
    );
    const support = screen.getByRole('link', { name: 'Ajuda e suporte' });
    expect(support).toHaveAttribute('href', '/support');
    await user.click(support);
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it('closes the drawer when the profile avatar navigates', async () => {
    const onNavigate = vi.fn();
    renderWithProviders(<AccountMenu onNavigate={onNavigate} />, { withGoogle: false });
    await userEvent.click(screen.getByRole('link', { name: 'Conta de Ana' }));
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    'clears local authentication on logout (request failure: %s)',
    async (fails) => {
      if (fails) vi.mocked(logout).mockRejectedValue(new Error('offline'));
      else vi.mocked(logout).mockResolvedValue(undefined);
      renderWithProviders(<AccountMenu onNavigate={vi.fn()} />, { withGoogle: false });
      await userEvent.click(screen.getByText('Ana'));
      await userEvent.click(screen.getByRole('button', { name: 'Sair' }));
      await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull());
      expect(useAuthStore.getState().user).toBeNull();
      expect(logout).toHaveBeenCalledOnce();
    },
  );
});

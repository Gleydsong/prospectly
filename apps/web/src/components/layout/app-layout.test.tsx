import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/features/theme/theme-provider';
import { AppLayout } from './app-layout';

vi.mock('@/features/billing/api', () => ({
  getBillingStatus: vi.fn(async () => ({
    plan: 'FREE',
    planStatus: 'INACTIVE',
    freeSearchLimit: 3,
    creditBalance: 15,
  })),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector?: (state: { user: { name: string; email: string } }) => unknown) => {
    const state = {
      user: {
        name: 'Test User',
        email: 'test@prospectly.test',
        organizationName: 'Org',
        avatarUrl: null,
        emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      },
      clear: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

function mockMatchMedia(desktop: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: desktop && query.includes('1024'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

function renderLayout() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('AppLayout shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.body.style.overflow = '';
  });

  it('renders primary sidebar navigation on desktop', () => {
    mockMatchMedia(true);
    renderLayout();
    const nav = screen.getByRole('navigation', { name: /navegação principal|main navigation/i });
    expect(within(nav).getByRole('link', { name: /principal|home/i })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: /assistentes/i })).toHaveAttribute('href', '/agents');
    expect(within(nav).getByRole('link', { name: /funil|pipeline/i })).toHaveAttribute(
      'href',
      '/pipeline',
    );
    expect(screen.getByRole('button', { name: /esconder menu|hide menu/i })).toBeInTheDocument();
  });

  it('opens and closes the mobile drawer with button, backdrop and Escape', async () => {
    mockMatchMedia(false);
    const user = userEvent.setup();
    renderLayout();

    const sidebar = document.getElementById('mobile-nav');
    expect(sidebar).toHaveAttribute('aria-hidden', 'true');

    await user.click(screen.getByRole('button', { name: /abrir menu|open menu/i }));
    expect(document.getElementById('mobile-nav')).toHaveAttribute('aria-hidden', 'false');

    await user.keyboard('{Escape}');
    expect(document.getElementById('mobile-nav')).toHaveAttribute('aria-hidden', 'true');

    await user.click(screen.getByRole('button', { name: /abrir menu|open menu/i }));
    await user.click(screen.getAllByRole('button', { name: /fechar menu|close menu/i })[0]);
    expect(document.getElementById('mobile-nav')).toHaveAttribute('aria-hidden', 'true');
  });

  it('hides the desktop sidebar from the aside control and restores it from the topbar', async () => {
    mockMatchMedia(true);
    const user = userEvent.setup();
    renderLayout();

    expect(document.getElementById('mobile-nav')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.queryByRole('button', { name: /mostrar menu|show menu/i })).toBeNull();

    await user.click(screen.getByRole('button', { name: /esconder menu|hide menu/i }));
    expect(document.getElementById('mobile-nav')).toHaveAttribute('aria-hidden', 'true');
    expect(window.localStorage.getItem('prospectly:sidebar-collapsed')).toBe('1');

    await user.click(screen.getByRole('button', { name: /mostrar menu|show menu/i }));
    expect(document.getElementById('mobile-nav')).toHaveAttribute('aria-hidden', 'false');
    expect(window.localStorage.getItem('prospectly:sidebar-collapsed')).toBe('0');
  });
});

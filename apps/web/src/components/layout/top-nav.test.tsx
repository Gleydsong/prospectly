import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/features/theme/theme-provider';
import { TopNav } from './top-nav';

vi.mock('@/features/billing/api', () => ({
  getBillingStatus: vi.fn(async () => ({
    plan: 'FREE',
    planStatus: 'INACTIVE',
    freeSearchLimit: 3,
    creditBalance: 2500,
  })),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    user: {
      name: 'Test User',
      organizationName: 'Org',
      avatarUrl: 'https://example.com/avatar.jpg',
    },
    clear: vi.fn(),
  }),
}));

describe('TopNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes principal navigation and tools entry', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <MemoryRouter>
            <TopNav />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('link', { name: /principal|home/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('navigation', { name: /navegação principal|main navigation/i })).toBeInTheDocument();
  });

  it('shows user avatar photo when avatarUrl is present', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <MemoryRouter>
            <TopNav />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    );

    const avatar = screen.getByRole('link', { name: /conta de test user|test user's account/i });
    expect(avatar).toHaveAttribute('href', '/settings');
    expect(avatar.querySelector('img')).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('shows the current credit balance with the credit label', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <MemoryRouter>
            <TopNav />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/2[,.]?500 créditos/i)).toBeInTheDocument();
  });

  it('links the search clients control to the prospecting search page', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <MemoryRouter>
            <TopNav />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('link', { name: /buscar clientes|search clients/i })).toHaveAttribute(
      'href',
      '/search',
    );
  });

  it('portals the mobile menu outside the sticky header so backdrop-filter cannot clip it', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <MemoryRouter>
            <TopNav />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: /abrir menu|open menu/i }));

    const overlay = screen.getAllByRole('button', { name: /fechar menu|close menu/i })[0];
    expect(overlay).toBeDefined();
    expect(overlay?.closest('header')).toBeNull();
    expect(document.getElementById('mobile-nav')).toBeTruthy();
  });
});

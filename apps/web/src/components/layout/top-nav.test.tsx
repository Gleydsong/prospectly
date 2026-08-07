import { render, screen } from '@testing-library/react';
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
});

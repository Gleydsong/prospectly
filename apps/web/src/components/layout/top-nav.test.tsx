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

function renderNav(props?: { onOpenNav?: () => void; navOpen?: boolean }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter>
          <TopNav onOpenNav={props?.onOpenNav ?? vi.fn()} navOpen={props?.navOpen ?? false} />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('TopNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps account and billing actions in the sidebar footer', () => {
    renderNav();
    expect(screen.queryByRole('link', { name: /account|conta/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /credits|créditos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sair|logout/i })).not.toBeInTheDocument();
  });

  it('links the search clients control to the prospecting search page', () => {
    renderNav();
    expect(
      screen.getAllByRole('link', { name: /buscar clientes|search clients/i })[0],
    ).toHaveAttribute('href', '/prospectar');
  });

  it('renders global search with shortcut badge', () => {
    renderNav();
    expect(screen.getByText('⌘K')).toBeInTheDocument();
  });

  it('exposes a menu control for the sidebar drawer', () => {
    const onOpenNav = vi.fn();
    renderNav({ onOpenNav });
    expect(screen.getByRole('button', { name: /abrir menu|open menu/i })).toHaveAttribute(
      'aria-controls',
      'mobile-nav',
    );
  });
});

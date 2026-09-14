import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { LeadWebsitesCard } from './lead-websites-card';

const apiMocks = vi.hoisted(() => ({
  fetchLeadWebsites: vi.fn(),
  createLeadWebsite: vi.fn(),
  updateLeadWebsite: vi.fn(),
  deleteLeadWebsite: vi.fn(),
}));

vi.mock('@/features/leads/api', () => apiMocks);

function renderCard(
  props: Partial<{
    emphasized: boolean;
    canMutate: boolean;
    prominence: 'primary' | 'secondary';
  }> = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LeadWebsitesCard
        leadId="lead-1"
        prominence={props.prominence ?? 'secondary'}
        emphasized={props.emphasized ?? false}
        canMutate={props.canMutate ?? true}
      />
    </QueryClientProvider>,
  );
}

describe('LeadWebsitesCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    vi.clearAllMocks();
    apiMocks.fetchLeadWebsites.mockResolvedValue([]);
  });

  it('emphasizes the Sites block after Ganhos', async () => {
    renderCard({ emphasized: true, prominence: 'primary' });
    expect(await screen.findByRole('heading', { name: /sites/i })).toBeInTheDocument();
    const region = screen.getByTestId('lead-websites-card');
    expect(region.className).toMatch(/border-brand|border-\[color:var\(--brand/);
  });

  it('hides mutate controls for VIEWER', async () => {
    renderCard({ canMutate: false });
    expect(await screen.findByTestId('lead-websites-card')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /adicionar/i })).not.toBeInTheDocument();
  });

  it('keeps the add control for members when the lead is not won', async () => {
    renderCard({ emphasized: false, canMutate: true, prominence: 'secondary' });
    expect(await screen.findByRole('button', { name: /adicionar/i })).toBeInTheDocument();
  });
});

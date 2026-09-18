import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import type { LeadListItem, LeadStatus } from '@/types';

import { LeadCardGrid } from './lead-card-grid';

function makeLead(overrides: Partial<LeadListItem> & Pick<LeadListItem, 'id' | 'companyName'>) {
  return {
    status: 'NEW' as LeadStatus,
    source: 'MANUAL' as LeadListItem['source'],
    score: 75,
    doNotContact: false,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as LeadListItem;
}

const LEAD_A = makeLead({
  id: 'lead-a',
  companyName: 'Padaria Alfa',
  city: 'São Paulo',
  segment: 'Alimentação',
});
const LEAD_B = makeLead({ id: 'lead-b', companyName: 'Clínica Sorriso', city: 'Campinas' });

describe('LeadCardGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a card per lead', () => {
    render(<LeadCardGrid leads={[LEAD_A, LEAD_B]} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Padaria Alfa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clínica Sorriso' })).toBeInTheDocument();
  });

  it('calls onSelect with the lead id when a card is clicked', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<LeadCardGrid leads={[LEAD_A, LEAD_B]} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Clínica Sorriso' }));

    expect(onSelect).toHaveBeenCalledWith('lead-b');
  });

  it('shows the empty label when there are no leads', () => {
    render(<LeadCardGrid leads={[]} onSelect={vi.fn()} emptyLabel="Nenhum lead" />);

    expect(screen.getByText('Nenhum lead')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Padaria Alfa' })).not.toBeInTheDocument();
  });
});

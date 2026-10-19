import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLeads } from '../api';
import { LeadStatus } from '@/types';
import { renderWithProviders } from '@/test/render';
import { LeadsKanban } from './leads-kanban';

vi.mock('../api', () => ({ fetchLeads: vi.fn() }));
beforeEach(() => {
  vi.mocked(fetchLeads).mockReset();
});

describe('Clients board', () => {
  it('counts all filtered clients per status and pages cards without truncating totals', async () => {
    vi.mocked(fetchLeads).mockImplementation(async (query) => ({
      data:
        query.status === LeadStatus.QUALIFIED
          ? ([
              {
                id: `saved-${query.page}`,
                companyName: `Cliente ${query.page}`,
                score: 92,
                status: LeadStatus.QUALIFIED,
              },
            ] as never)
          : [],
      meta: {
        page: query.page!,
        pageSize: 20,
        total: query.status === LeadStatus.QUALIFIED ? 1234 : 0,
        totalPages: query.status === LeadStatus.QUALIFIED ? 62 : 0,
      },
    }));
    renderWithProviders(
      <LeadsKanban label="Quadro" filters={{ city: 'Lisboa', segment: 'Saúde', q: 'Cliente' }} />,
    );
    const qualified = screen.getByRole('listitem', { name: 'Qualificado' });
    expect(await within(qualified).findByText('1234')).toBeInTheDocument();
    expect(within(qualified).getAllByRole('link')).toHaveLength(1);
    fireEvent.click(within(qualified).getByRole('button', { name: 'Carregar mais clientes' }));
    expect(await within(qualified).findByText('Cliente 2')).toBeInTheDocument();
    expect(within(qualified).getByText('1234')).toBeInTheDocument();
    expect(fetchLeads).toHaveBeenCalledWith({
      city: 'Lisboa',
      segment: 'Saúde',
      q: 'Cliente',
      status: LeadStatus.QUALIFIED,
      page: 2,
      pageSize: 20,
    });
    expect(screen.getByRole('listitem', { name: 'Negociação' })).toBeInTheDocument();
  });

  it('keeps an explicit status filter instead of querying other stages', async () => {
    vi.mocked(fetchLeads).mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
    renderWithProviders(
      <LeadsKanban label="Quadro" filters={{ status: LeadStatus.NEGOTIATION }} />,
    );
    await within(screen.getByRole('listitem', { name: 'Negociação' })).findByText('0');
    expect(fetchLeads).toHaveBeenCalledTimes(1);
    expect(fetchLeads).toHaveBeenCalledWith({
      status: LeadStatus.NEGOTIATION,
      page: 1,
      pageSize: 20,
    });
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { PipelinePage } from './pipeline-page';

const mocks = vi.hoisted(() => ({
  fetchPipelineBoard: vi.fn(),
  fetchStageLeads: vi.fn(),
  moveLeadToStage: vi.fn(),
}));

vi.mock('@/features/pipeline/api', () => ({
  fetchPipelineBoard: mocks.fetchPipelineBoard,
  fetchStageLeads: mocks.fetchStageLeads,
  moveLeadToStage: mocks.moveLeadToStage,
}));

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

const boardFixture = {
  pipeline: { id: 'pipe-1', name: 'Default' },
  limit: 50,
  offset: 0,
  stages: [
    {
      id: 'stage-a',
      name: 'Novo',
      order: 0,
      color: '#22c55e',
      totalCount: 1,
      hasMore: false,
      leads: [
        {
          id: 'lead-1',
          companyName: 'Café Central',
          city: 'Lisboa',
          score: 72,
          status: 'NEW',
          source: 'MANUAL',
          doNotContact: false,
          tags: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          owner: { id: 'u1', name: 'Ana' },
        },
      ],
    },
    {
      id: 'stage-b',
      name: 'Contato',
      order: 1,
      color: '#3b82f6',
      totalCount: 0,
      hasMore: false,
      leads: [],
    },
  ],
};

describe('PipelinePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchPipelineBoard.mockResolvedValue(boardFixture);
    mocks.moveLeadToStage.mockResolvedValue(undefined);
  });

  it('moves a lead between stages with the keyboard-accessible select', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <PipelinePage />
      </Wrapper>,
    );

    const moveControl = await screen.findByLabelText('Mover Café Central para etapa');
    await user.selectOptions(moveControl, 'stage-b');

    await waitFor(() => {
      expect(mocks.moveLeadToStage).toHaveBeenCalledWith('lead-1', 'stage-b');
    });

    expect(await screen.findByRole('status')).toHaveTextContent('Café Central movido para Contato');
  });

  it('shows column totals and loads more leads past the first page', async () => {
    const user = userEvent.setup();
    mocks.fetchPipelineBoard.mockResolvedValue({
      ...boardFixture,
      stages: [
        {
          ...boardFixture.stages[0]!,
          totalCount: 120,
          hasMore: true,
          leads: boardFixture.stages[0]!.leads,
        },
        boardFixture.stages[1]!,
      ],
    });
    mocks.fetchStageLeads.mockResolvedValue({
      stage: { id: 'stage-a', name: 'Novo' },
      totalCount: 120,
      hasMore: true,
      limit: 50,
      offset: 1,
      leads: [
        {
          id: 'lead-2',
          companyName: 'Padaria Norte',
          city: 'Porto',
          score: 55,
          status: 'NEW',
          source: 'MANUAL',
          doNotContact: false,
          tags: [],
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    });

    render(
      <Wrapper>
        <PipelinePage />
      </Wrapper>,
    );

    const column = await screen.findByLabelText(/Novo, 1 de 120 clientes potenciais/);
    expect(within(column).getByText('120')).toBeInTheDocument();

    await user.click(within(column).getByRole('button', { name: /Carregar mais \(119\)/i }));

    await waitFor(() => {
      expect(mocks.fetchStageLeads).toHaveBeenCalledWith('stage-a', { limit: 50, offset: 1 });
    });
    expect(await within(column).findByText('Padaria Norte')).toBeInTheDocument();
  });
});

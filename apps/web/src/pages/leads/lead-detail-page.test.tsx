import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { LeadDetailPage } from './lead-detail-page';

const mocks = vi.hoisted(() => ({
  moveLeadToStage: vi.fn(),
  fetchPipelines: vi.fn(),
  useLead: vi.fn(),
}));

vi.mock('@/features/leads/hooks', () => ({
  useLead: (...args: unknown[]) => mocks.useLead(...args),
  useLeadActivities: () => ({ data: { data: [] }, isLoading: false }),
  useCreateActivity: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/features/tasks/api', () => ({
  fetchTasks: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, totalPages: 1, total: 0 } }),
}));

vi.mock('@/features/tasks/hooks', () => ({
  useCreateTaskForLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/features/scoring/api', () => ({ requestLeadWebsiteAnalysis: vi.fn() }));

vi.mock('@/features/pipeline/api', () => ({
  fetchPipelines: (...args: unknown[]) => mocks.fetchPipelines(...args),
  moveLeadToStage: (...args: unknown[]) => mocks.moveLeadToStage(...args),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/leads/lead-1']}>
        <Routes>
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/pipeline" element={<p>Página do funil</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LeadDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useLead.mockReturnValue({
      data: {
        id: 'lead-1',
        companyName: 'Medic Saúde',
        category: 'clinic',
        city: 'Mata Grande',
        country: 'BR',
        status: 'TO_REVIEW',
        source: 'GOOGLE_PLACES',
        score: 35,
        doNotContact: false,
        stage: null,
        tags: [],
        contacts: [],
        createdAt: '2026-08-15T01:00:00.000Z',
        updatedAt: '2026-08-15T01:00:00.000Z',
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.fetchPipelines.mockResolvedValue([
      {
        id: 'pipeline-1',
        name: 'Funil padrão',
        isDefault: true,
        stages: [
          { id: 'stage-review', name: 'Em análise', order: 1 },
          { id: 'stage-new', name: 'Novos', order: 0 },
        ],
      },
    ]);
    mocks.moveLeadToStage.mockResolvedValue(undefined);
  });

  it('envia o cliente para a primeira etapa do funil padrão', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Enviar para o funil' }));

    await waitFor(() => {
      expect(mocks.moveLeadToStage).toHaveBeenCalledWith('lead-1', 'stage-new');
    });
    expect(
      await screen.findByText('Cliente potencial adicionado à etapa “Novos” do funil.'),
    ).toBeVisible();
  });

  it('abre o funil quando o cliente já possui uma etapa', async () => {
    const current = mocks.useLead();
    mocks.useLead.mockReturnValue({
      ...current,
      data: { ...current.data, stage: { id: 'stage-new', name: 'Novos' } },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Ver no funil' }));

    expect(await screen.findByText('Página do funil')).toBeVisible();
    expect(mocks.moveLeadToStage).not.toHaveBeenCalled();
  });
});

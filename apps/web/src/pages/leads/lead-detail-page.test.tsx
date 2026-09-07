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
  createActivity: vi.fn(),
  updateTask: vi.fn(),
  fetchTasks: vi.fn(),
}));

vi.mock('@/features/leads/hooks', () => ({
  useLead: (...args: unknown[]) => mocks.useLead(...args),
  useLeadActivities: () => ({ data: { data: [] }, isLoading: false }),
  useCreateActivity: () => ({ mutateAsync: mocks.createActivity, isPending: false }),
  useUpdateLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAddLeadTags: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveLeadTag: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/features/tasks/api', () => ({
  fetchTasks: (...args: unknown[]) => mocks.fetchTasks(...args),
}));

vi.mock('@/features/tasks/hooks', () => ({
  useCreateTaskForLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTask: () => ({ mutateAsync: mocks.updateTask, isPending: false }),
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
          <Route path="/agents/crm" element={<p>Assistente CRM</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const baseLead = {
  id: 'lead-1',
  companyName: 'Medic Saúde',
  category: 'clinic',
  city: 'Mata Grande',
  country: 'BR',
  phone: '+5511999887766',
  address: 'Rua das Flores, 10',
  state: 'AL',
  status: 'TO_REVIEW',
  source: 'GOOGLE_PLACES',
  score: 35,
  doNotContact: false,
  stage: null,
  tags: [],
  contacts: [],
  website: null,
  email: null,
  notes: null,
  createdAt: '2026-08-15T01:00:00.000Z',
  updatedAt: '2026-08-15T01:00:00.000Z',
};

describe('LeadDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useLead.mockReturnValue({
      data: baseLead,
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
    mocks.fetchTasks.mockResolvedValue({
      data: [{ id: 'task-1', title: 'Retornar ligação', status: 'OPEN', priority: 'MEDIUM' }],
      meta: { page: 1, totalPages: 1, total: 1 },
    });
    mocks.updateTask.mockResolvedValue({ id: 'task-1', status: 'DONE' });
    mocks.createActivity.mockResolvedValue({ id: 'act-1' });
  });

  it('avança o cliente no funil com um clique na etapa', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Novos' }));

    await waitFor(() => {
      expect(mocks.moveLeadToStage).toHaveBeenCalledWith('lead-1', 'stage-new');
    });
    expect(
      await screen.findByText('Cliente potencial movido para a etapa “Novos” do funil.'),
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

  it('não mostra o card vazio de análise do site e oferece busca no Google', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'Buscar no Google' })).toHaveAttribute(
      'href',
      'https://www.google.com/search?q=Medic%20Sa%C3%BAde%20Mata%20Grande',
    );
    expect(screen.getByRole('button', { name: 'Inserir URL' })).toBeInTheDocument();
    expect(screen.queryByText('Análise do site')).not.toBeInTheDocument();
    expect(screen.queryByText('Sem site cadastrado')).not.toBeInTheDocument();
    expect(screen.getByText(/oportunidade de presença online/i)).toBeInTheDocument();
  });

  it('esconde metadados técnicos até abrir a auditoria', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByText('Google Places')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Origem & Auditoria Técnica' }));
    expect(screen.getByText('Google Places')).toBeVisible();
  });

  it('conclui tarefa no checkbox e registra na timeline', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('checkbox', { name: 'Concluir tarefa Retornar ligação' }),
    );

    await waitFor(() => {
      expect(mocks.updateTask).toHaveBeenCalledWith({ id: 'task-1', status: 'DONE' });
    });
    expect(mocks.createActivity).toHaveBeenCalledWith({
      type: 'TASK',
      description: 'Tarefa concluída: Retornar ligação',
    });
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import type { LeadListItem, LeadStatus } from '@/types';
import { AgentsCrmPage } from './agents-crm-page';

function makePickerLead(
  overrides: Partial<LeadListItem> & Pick<LeadListItem, 'id' | 'companyName'>,
): LeadListItem {
  return {
    status: 'NEW' as LeadStatus,
    source: 'SEARCH',
    score: 35,
    doNotContact: false,
    tags: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    city: 'Afogados da Ingazeira',
    ...overrides,
  } as LeadListItem;
}

const mocks = vi.hoisted(() => ({
  useCrmSuggest: vi.fn(),
  useCrmDailyFocus: vi.fn(),
  crmApplyMutateAsync: vi.fn(),
  fetchLead: vi.fn(),
  fetchLeads: vi.fn(),
}));

vi.mock('@/features/agents/hooks', () => ({
  useCrmSuggest: (...args: unknown[]) => mocks.useCrmSuggest(...args),
  useCrmDailyFocus: () => mocks.useCrmDailyFocus(),
  useCrmApply: () => ({
    mutateAsync: mocks.crmApplyMutateAsync,
    isPending: false,
  }),
  useWhatsappVariants: () => ({
    data: { variants: [], digits: '5511999998888' },
    isLoading: false,
    isError: false,
  }),
  useWhatsappRecordOutreach: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/features/leads/api', () => ({
  fetchLead: (...args: unknown[]) => mocks.fetchLead(...args),
  fetchLeads: (...args: unknown[]) => mocks.fetchLeads(...args),
}));

vi.mock('@/features/pipeline/api', () => ({
  fetchPipelines: vi.fn().mockResolvedValue([
    {
      id: 'pipeline-1',
      name: 'Funil Principal',
      isDefault: true,
      stages: [
        { id: 's-1', name: 'Novo', order: 0 },
        { id: 's-2', name: 'Contato Feito', order: 1 },
        { id: 's-3', name: 'Negociação', order: 2 },
      ],
    },
  ]),
}));

function Wrapper({
  children,
  initialEntry = '/agents/crm',
}: PropsWithChildren<{ initialEntry?: string }>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/agents/crm" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AgentsCrmPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchLead.mockResolvedValue({
      id: 'lead-1',
      companyName: 'Restaurante Central',
      phone: '+5511999998888',
      whatsapp: null,
    });
    mocks.fetchLeads.mockResolvedValue({ data: [] });
    mocks.useCrmDailyFocus.mockReturnValue({
      data: {
        items: [
          {
            taskId: 'task-1',
            description: 'Ligar para retorno',
            leadId: 'lead-1',
            companyName: 'Restaurante Central',
            phone: '5511999998888',
            reason: 'OVERDUE_TASK',
          },
        ],
        totalCount: 1,
      },
      isLoading: false,
      isError: false,
    });

    mocks.useCrmSuggest.mockReturnValue({
      data: {
        leadId: 'lead-1',
        companyName: 'Restaurante Central',
        score: 75,
        status: 'NEW',
        currentStage: { id: 's-1', name: 'Novo' },
        suggestedStage: { id: 's-2', name: 'Contato Feito' },
        actionCode: 'PRIORITIZE_OUTREACH',
        rationale: 'Score alto e sem interação recente.',
        severity: 'critical',
        href: '/agents/whatsapp?leadId=lead-1',
        canApplyStage: true,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('renders daily focus and lead picker when no leadId is in URL', async () => {
    render(
      <Wrapper initialEntry="/agents/crm">
        <AgentsCrmPage />
      </Wrapper>,
    );

    expect(await screen.findByText(/Foco do Dia/i)).toBeInTheDocument();
    expect(screen.getByText(/Ligar para retorno/i)).toBeInTheDocument();
    expect(screen.getByText(/Escolher cliente potencial/i)).toBeInTheDocument();
  });

  it('renders suggestion and applies stage when leadId is present', async () => {
    const user = userEvent.setup();
    mocks.crmApplyMutateAsync.mockResolvedValue({ applied: true });

    render(
      <Wrapper initialEntry="/agents/crm?leadId=lead-1">
        <AgentsCrmPage />
      </Wrapper>,
    );

    expect(await screen.findByText(/Score alto e sem interação recente/i)).toBeInTheDocument();
    expect(screen.getByText('Novo')).toBeInTheDocument();
    expect(screen.getByText('Contato Feito')).toBeInTheDocument();

    const moveBtn = screen.getByRole('button', { name: /mover estágio/i });
    await user.click(moveBtn);

    const option = await screen.findByRole('menuitem', { name: 'Contato Feito' });
    await user.click(option);

    await waitFor(() => {
      expect(mocks.crmApplyMutateAsync).toHaveBeenCalledWith({
        leadId: 'lead-1',
        stageId: 's-2',
      });
    });
  });

  it('shows a friendly message and clears the selection when apply returns 404', async () => {
    const user = userEvent.setup();
    mocks.crmApplyMutateAsync.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { message: 'Lead not found' } },
    });

    render(
      <Wrapper initialEntry="/agents/crm?leadId=lead-1">
        <AgentsCrmPage />
      </Wrapper>,
    );

    await user.click(await screen.findByRole('button', { name: /mover estágio/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Contato Feito' }));

    expect(
      await screen.findByText(/Cliente potencial não encontrado/i),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Escolher cliente potencial/i)).toBeInTheDocument();
  });

  it('shows a friendly message and returns to the picker when suggest returns 404', async () => {
    mocks.useCrmSuggest.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { isAxiosError: true, response: { status: 404, data: { message: 'Lead not found' } } },
      refetch: vi.fn(),
    });

    render(
      <Wrapper initialEntry="/agents/crm?leadId=missing-lead">
        <AgentsCrmPage />
      </Wrapper>,
    );

    expect(
      await screen.findByText(/Cliente potencial não encontrado/i),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Escolher cliente potencial/i)).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível sugerir/i)).not.toBeInTheDocument();
  });

  it('paginates the picker so older CRM leads stay reachable after a new send', async () => {
    const user = userEvent.setup();
    const allLeads = Array.from({ length: 15 }, (_, index) =>
      makePickerLead({
        id: `lead-${index + 1}`,
        companyName: `Empresa ${index + 1}`,
      }),
    );
    mocks.fetchLeads.mockImplementation(async (query: { page?: number; pageSize?: number }) => {
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 10;
      const start = (page - 1) * pageSize;
      return {
        data: allLeads.slice(start, start + pageSize),
        meta: {
          page,
          pageSize,
          total: allLeads.length,
          totalPages: Math.ceil(allLeads.length / pageSize),
        },
      };
    });

    render(
      <Wrapper initialEntry="/agents/crm">
        <AgentsCrmPage />
      </Wrapper>,
    );

    expect(await screen.findByRole('button', { name: 'Empresa 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Empresa 13' })).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Próxima página' }));

    expect(await screen.findByRole('button', { name: 'Empresa 13' })).toBeInTheDocument();
    expect(mocks.fetchLeads).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it('filters the picker by city and CRM send date', async () => {
    const user = userEvent.setup();
    mocks.fetchLeads.mockResolvedValue({
      data: [
        makePickerLead({
          id: 'lead-recife',
          companyName: 'Studio Recife',
          city: 'Recife',
          createdAt: '2026-09-19T12:00:00.000Z',
        }),
      ],
      meta: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
    });

    render(
      <Wrapper initialEntry="/agents/crm">
        <AgentsCrmPage />
      </Wrapper>,
    );

    await user.type(await screen.findByLabelText('Cidade'), 'Recife');
    await user.type(screen.getByLabelText('Enviado de'), '2026-09-01');
    await user.type(screen.getByLabelText('Enviado até'), '2026-09-19');

    await waitFor(() => {
      expect(mocks.fetchLeads).toHaveBeenCalledWith(
        expect.objectContaining({
          city: 'Recife',
          createdFrom: '2026-09-01',
          createdTo: '2026-09-19',
        }),
      );
    });
  });

  it('returns to the picker when fetchLead returns 404', async () => {
    mocks.fetchLead.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { message: 'Lead not found' } },
    });

    render(
      <Wrapper initialEntry="/agents/crm?leadId=missing-lead">
        <AgentsCrmPage />
      </Wrapper>,
    );

    expect(
      await screen.findByText(/Cliente potencial não encontrado/i),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Escolher cliente potencial/i)).toBeInTheDocument();
  });
});

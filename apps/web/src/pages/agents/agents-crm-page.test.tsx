import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { AgentsCrmPage } from './agents-crm-page';

const mocks = vi.hoisted(() => ({
  useCrmSuggest: vi.fn(),
  useCrmDailyFocus: vi.fn(),
  crmApplyMutateAsync: vi.fn(),
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
  fetchLead: vi.fn().mockResolvedValue({
    id: 'lead-1',
    companyName: 'Restaurante Central',
    phone: '+5511999998888',
    whatsapp: null,
  }),
  fetchLeads: vi.fn().mockResolvedValue({ data: [] }),
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

    await waitFor(() => {
      expect(mocks.crmApplyMutateAsync).toHaveBeenCalledWith({
        leadId: 'lead-1',
        stageId: 's-2',
      });
    });
  });
});

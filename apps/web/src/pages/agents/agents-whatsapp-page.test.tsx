import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { AgentsWhatsappPage } from './agents-whatsapp-page';

const mocks = vi.hoisted(() => ({
  useWhatsappVariants: vi.fn(),
  recordOutreachMutateAsync: vi.fn(),
}));

vi.mock('@/features/agents/hooks', () => ({
  useWhatsappVariants: (...args: unknown[]) => mocks.useWhatsappVariants(...args),
  useWhatsappRecordOutreach: () => ({
    mutateAsync: mocks.recordOutreachMutateAsync,
    isPending: false,
  }),
  useWhatsappFirstMessage: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('@/features/pipeline/api', () => ({
  fetchPipelines: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/features/campaigns/hooks', () => ({
  useMessageTemplates: () => ({
    data: { data: [] },
    isLoading: false,
  }),
}));

vi.mock('@/features/leads/api', () => ({
  fetchLead: vi.fn().mockResolvedValue({
    id: 'lead-1',
    companyName: 'Salão Resenha',
    phone: '+5581987950071',
    whatsapp: null,
  }),
  fetchLeads: vi.fn().mockResolvedValue({ data: [] }),
}));

function variantPack(seed: number) {
  return {
    leadId: 'lead-1',
    companyName: 'Salão Resenha',
    phone: '+5581987950071',
    digits: '5581987950071',
    source: 'fallback' as const,
    seed,
    variants: [
      {
        id: `fallback-${seed}-direto-1`,
        angle: 'direto',
        label: 'Direto',
        body: seed === 0 ? 'Olá! Vi o Salão Resenha em Recife.' : 'Oi! Falo com o Salão Resenha.',
      },
      {
        id: `fallback-${seed}-curiosidade-2`,
        angle: 'curiosidade',
        label: 'Curiosidade',
        body: 'Oi! Curiosidade rápida sobre o Salão Resenha.',
      },
      {
        id: `fallback-${seed}-prova_social-3`,
        angle: 'prova_social',
        label: 'Prova social',
        body: 'Olá! Negócios em Recife parecidos com o Salão Resenha.',
      },
      {
        id: `fallback-${seed}-dor_site-4`,
        angle: 'dor_site',
        label: 'Dor do site',
        body: 'Oi! Notei que o Salão Resenha ainda não aparece com presença digital.',
      },
    ],
    autoSend: false as const,
    messageSent: false as const,
  };
}

function Wrapper({
  children,
  initialEntry = '/agents/whatsapp?leadId=lead-1',
}: PropsWithChildren<{ initialEntry?: string }>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/agents/whatsapp" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AgentsWhatsappPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useWhatsappVariants.mockImplementation((_leadId?: string, _count?: number, seed = 0) => ({
      data: variantPack(seed),
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }));
  });

  it('renders variants and fills preview from selection', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <AgentsWhatsappPage />
      </Wrapper>,
    );

    expect(await screen.findByTestId('whatsapp-variants-list')).toBeInTheDocument();
    expect(screen.getByTestId('whatsapp-source-badge')).toHaveTextContent(/modelo local|local model/i);

    await user.click(screen.getByTestId('whatsapp-variant-curiosidade'));
    await waitFor(() => {
      expect(screen.getByTestId('whatsapp-preview')).toHaveValue(
        'Oi! Curiosidade rápida sobre o Salão Resenha.',
      );
    });
  });

  it('allows editing preview and bumps generation on regenerate', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <AgentsWhatsappPage />
      </Wrapper>,
    );

    const preview = await screen.findByTestId('whatsapp-preview');
    await user.clear(preview);
    await user.type(preview, 'Mensagem editada');
    expect(preview).toHaveValue('Mensagem editada');

    await user.click(screen.getByTestId('whatsapp-regenerate'));

    await waitFor(() => {
      const lastCall = mocks.useWhatsappVariants.mock.calls.at(-1);
      expect(lastCall?.[2]).toBe(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId('whatsapp-preview')).toHaveValue('Oi! Falo com o Salão Resenha.');
    });
  });

  it('allows switching sequence stage and records outreach in CRM', async () => {
    const user = userEvent.setup();
    mocks.recordOutreachMutateAsync.mockResolvedValue({
      leadId: 'lead-1',
      activityId: 'act-1',
      stageChanged: false,
      taskCreated: true,
      sequenceStage: 'FOLLOW_UP_1',
    });

    render(
      <Wrapper>
        <AgentsWhatsappPage />
      </Wrapper>,
    );

    const followUpTab = await screen.findByTestId('sequence-tab-FOLLOW_UP_1');
    await user.click(followUpTab);

    await waitFor(() => {
      const lastCall = mocks.useWhatsappVariants.mock.calls.at(-1);
      expect(lastCall?.[3]).toBe('FOLLOW_UP_1');
    });

    const openConfirmBtn = screen.getByRole('button', { name: /registrar abordagem no crm/i });
    await user.click(openConfirmBtn);

    const saveBtn = await screen.findByTestId('confirm-outreach-crm-button');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mocks.recordOutreachMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: 'lead-1',
          sequenceStage: 'FOLLOW_UP_1',
        }),
      );
    });
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { AgentsWhatsappPage } from './agents-whatsapp-page';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
}));

vi.mock('@/features/agents/hooks', () => ({
  useWhatsappVariants: () => ({
    data: {
      leadId: 'lead-1',
      companyName: 'Salão Resenha',
      phone: '+5581987950071',
      digits: '5581987950071',
      source: 'fallback',
      variants: [
        {
          id: 'fallback-direto-1',
          angle: 'direto',
          label: 'Direto',
          body: 'Olá! Vi o Salão Resenha em Recife.',
        },
        {
          id: 'fallback-curiosidade-2',
          angle: 'curiosidade',
          label: 'Curiosidade',
          body: 'Oi! Curiosidade rápida sobre o Salão Resenha.',
        },
        {
          id: 'fallback-prova_social-3',
          angle: 'prova_social',
          label: 'Prova social',
          body: 'Olá! Negócios em Recife parecidos com o Salão Resenha.',
        },
        {
          id: 'fallback-dor_site-4',
          angle: 'dor_site',
          label: 'Dor do site',
          body: 'Oi! Notei que o Salão Resenha ainda não aparece com presença digital.',
        },
      ],
      autoSend: false,
      messageSent: false,
    },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: mocks.refetch,
  }),
  useWhatsappFirstMessage: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
  }),
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
    mocks.refetch.mockResolvedValue(undefined);
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

  it('allows editing preview and triggers regenerate', async () => {
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
    expect(mocks.refetch).toHaveBeenCalled();
  });
});

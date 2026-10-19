import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { WhatsAppOutreachModal } from './whatsapp-outreach-modal';

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
}));

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('WhatsAppOutreachModal', () => {
  const sampleLead = {
    id: 'lead-test-1',
    companyName: 'Padaria Central',
    phone: '+5511999998888',
    whatsapp: '5511999998888',
    stageId: 'stage-1',
    doNotContact: false,
  };

  const sampleStages = [
    { id: 'stage-1', name: 'Novo Lead' },
    { id: 'stage-2', name: 'Contatado' },
    { id: 'stage-3', name: 'Em Negociação' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useWhatsappVariants.mockImplementation(
      (_leadId, _count, _seed, stage = 'FIRST_MESSAGE') => ({
        data: {
          leadId: 'lead-test-1',
          companyName: 'Padaria Central',
          phone: '+5511999998888',
          digits: '5511999998888',
          source: 'ollama' as const,
          seed: 0,
          variants: [
            {
              id: `variant-direto-${stage}`,
              angle: 'direto',
              label: 'Direto',
              body: `Mensagem direto para ${stage}`,
            },
          ],
        },
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      }),
    );
  });

  it('renders lead info, sequence tabs, and initial variant preview', async () => {
    render(
      <Wrapper>
        <WhatsAppOutreachModal
          isOpen={true}
          onClose={vi.fn()}
          lead={sampleLead}
          stages={sampleStages}
        />
      </Wrapper>,
    );

    expect(await screen.findByText(/Padaria Central/i)).toBeInTheDocument();
    expect(screen.getByTestId('whatsapp-modal-source-badge')).toHaveTextContent(/ia/i);
    expect(screen.getByTestId('whatsapp-modal-preview')).toHaveValue(
      'Mensagem direto para FIRST_MESSAGE',
    );
  });

  it('switches sequence stage and updates variant request', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <WhatsAppOutreachModal
          isOpen={true}
          onClose={vi.fn()}
          lead={sampleLead}
          stages={sampleStages}
        />
      </Wrapper>,
    );

    await user.click(screen.getByText('Opções de abordagem'));
    const followUpTab = screen.getByTestId('sequence-tab-FOLLOW_UP_1');
    await user.click(followUpTab);

    await waitFor(() => {
      const lastCall = mocks.useWhatsappVariants.mock.calls.at(-1);
      expect(lastCall?.[3]).toBe('FOLLOW_UP_1');
    });
  });

  it('submits outreach recording with selected options', async () => {
    const user = userEvent.setup();
    mocks.recordOutreachMutateAsync.mockResolvedValue({
      leadId: 'lead-test-1',
      activityId: 'act-1',
      stageChanged: true,
      taskCreated: true,
      sequenceStage: 'FIRST_MESSAGE',
    });

    render(
      <Wrapper>
        <WhatsAppOutreachModal
          isOpen={true}
          onClose={vi.fn()}
          lead={sampleLead}
          stages={sampleStages}
        />
      </Wrapper>,
    );

    // Open confirmation
    const confirmTrigger = screen.getByRole('button', { name: /registrar abordagem no crm/i });
    await user.click(confirmTrigger);

    // Click confirm & save
    const saveButton = await screen.findByTestId('confirm-outreach-crm-button');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mocks.recordOutreachMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: 'lead-test-1',
          sequenceStage: 'FIRST_MESSAGE',
          advanceStageId: 'stage-2',
        }),
      );
    });
  });

  it('displays DNC warning and disables open when doNotContact is true', async () => {
    render(
      <Wrapper>
        <WhatsAppOutreachModal
          isOpen={true}
          onClose={vi.fn()}
          lead={{ ...sampleLead, doNotContact: true }}
          stages={sampleStages}
        />
      </Wrapper>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/não contatar|dnc/i);
    const openBtn = screen.getByRole('button', { name: /abrir whatsapp/i });
    expect(openBtn).toBeDisabled();
  });

  it('does not sync variant, preview or stage through effects', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'whatsapp-outreach-modal.tsx'),
      'utf8',
    );

    expect(source.match(/\buseEffect\(/g)?.length ?? 0).toBe(0);
    expect(source).toContain("from '@/features/agents/whatsapp-compose'");
  });
  it('abre a mensagem editada e mantém o contexto e a ação Cancelar', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const close = vi.fn();
    render(
      <Wrapper>
        <WhatsAppOutreachModal
          isOpen
          onClose={close}
          lead={{ ...sampleLead, context: 'Retornar amanhã', initialMessage: 'Olá!' }}
        />
      </Wrapper>,
    );
    expect(screen.getByText('Retornar amanhã')).toBeVisible();
    const message = screen.getByLabelText('Mensagem');
    await user.clear(message);
    await user.type(message, 'Mensagem revisada');
    await user.click(screen.getByRole('button', { name: 'Abrir WhatsApp' }));
    expect(open).toHaveBeenCalledWith(
      'https://wa.me/5511999998888?text=Mensagem%20revisada',
      '_blank',
      'noopener,noreferrer',
    );
    expect(mocks.recordOutreachMutateAsync).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('não solicita variantes nem abre WhatsApp para um cliente suprimido', () => {
    render(
      <Wrapper>
        <WhatsAppOutreachModal
          isOpen
          onClose={vi.fn()}
          lead={{ ...sampleLead, suppressed: true }}
        />
      </Wrapper>,
    );
    expect(mocks.useWhatsappVariants.mock.calls.at(-1)?.[0]).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Abrir WhatsApp' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sugerir mensagem' })).toBeDisabled();
  });
  it('permite composição manual quando a sugestão assistida falha', async () => {
    mocks.useWhatsappVariants.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: new Error('Suggestion unavailable'),
    });
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(
      <Wrapper>
        <WhatsAppOutreachModal isOpen onClose={vi.fn()} lead={sampleLead} />
      </Wrapper>,
    );
    await user.type(screen.getByLabelText('Mensagem'), 'Olá, posso ajudar?');
    await user.click(screen.getByRole('button', { name: 'Abrir WhatsApp' }));
    expect(open).toHaveBeenCalledWith(
      'https://wa.me/5511999998888?text=Ol%C3%A1%2C%20posso%20ajudar%3F',
      '_blank',
      'noopener,noreferrer',
    );
    open.mockRestore();
  });
});

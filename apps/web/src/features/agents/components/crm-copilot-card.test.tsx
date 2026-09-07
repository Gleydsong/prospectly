import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { CrmCopilotCard } from './crm-copilot-card';

const mocks = vi.hoisted(() => ({
  useCrmSuggest: vi.fn(),
  crmApplyMutateAsync: vi.fn(),
}));

vi.mock('@/features/agents/hooks', () => ({
  useCrmSuggest: (...args: unknown[]) => mocks.useCrmSuggest(...args),
  useCrmApply: () => ({
    mutateAsync: mocks.crmApplyMutateAsync,
    isPending: false,
  }),
}));

describe('CrmCopilotCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCrmSuggest.mockReturnValue({
      data: {
        leadId: 'lead-1',
        companyName: 'Boutique Silva',
        score: 85,
        status: 'NEW',
        currentStage: { id: 'stage-1', name: 'Lead Novo', order: 0 },
        suggestedStage: { id: 'stage-2', name: 'Contatado', order: 1 },
        actionCode: 'PRIORITIZE_OUTREACH',
        rationale: 'Lead quente com score alto sem contato registrado.',
        severity: 'critical',
        href: '/agents/whatsapp?leadId=lead-1',
        canApplyStage: true,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('renders suggestion details, rationale and stage transition', () => {
    render(
      <MemoryRouter>
        <CrmCopilotCard leadId="lead-1" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('crm-copilot-card')).toBeInTheDocument();
    expect(screen.getByText(/Lead quente com score alto sem contato registrado/i)).toBeInTheDocument();
    expect(screen.getByText('Lead Novo')).toBeInTheDocument();
    expect(screen.getByText('Contatado')).toBeInTheDocument();
  });

  it('calls onOpenWhatsApp when user clicks outreach button', async () => {
    const user = userEvent.setup();
    const handleOpenWhatsApp = vi.fn();

    render(
      <MemoryRouter>
        <CrmCopilotCard leadId="lead-1" onOpenWhatsApp={handleOpenWhatsApp} />
      </MemoryRouter>,
    );

    const whatsappBtn = screen.getByTestId('copilot-open-whatsapp');
    await user.click(whatsappBtn);
    expect(handleOpenWhatsApp).toHaveBeenCalled();
  });

  it('applies suggested stage when clicking move stage button', async () => {
    const user = userEvent.setup();
    mocks.crmApplyMutateAsync.mockResolvedValue({
      leadId: 'lead-1',
      stageId: 'stage-2',
      stage: { id: 'stage-2', name: 'Contatado' },
      applied: true,
    });

    render(
      <MemoryRouter>
        <CrmCopilotCard leadId="lead-1" />
      </MemoryRouter>,
    );

    const applyBtn = screen.getByTestId('copilot-apply-stage');
    await user.click(applyBtn);

    await waitFor(() => {
      expect(mocks.crmApplyMutateAsync).toHaveBeenCalledWith({
        leadId: 'lead-1',
        stageId: 'stage-2',
      });
    });
  });
});

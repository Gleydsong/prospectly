import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { CrmDailyFocus } from './crm-daily-focus';

const mocks = vi.hoisted(() => ({
  useCrmDailyFocus: vi.fn(),
}));

vi.mock('@/features/agents/hooks', () => ({
  useCrmDailyFocus: () => mocks.useCrmDailyFocus(),
}));

describe('CrmDailyFocus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCrmDailyFocus.mockReturnValue({
      data: {
        items: [
          {
            taskId: 'task-1',
            description: 'Ligar para retorno comercial',
            leadId: 'lead-1',
            companyName: 'Padaria Alfa',
            phone: '5511999991111',
            reason: 'OVERDUE_TASK',
          },
          {
            leadId: 'lead-2',
            companyName: 'Clínica Sorriso',
            score: 90,
            stageName: 'Novo Lead',
            description: 'Score alto pronto para contato',
            phone: '5511999992222',
            reason: 'HOT_NEW_LEAD',
          },
          {
            leadId: 'lead-3',
            companyName: 'Oficina Mecânica Beta',
            stageName: 'Contatado',
            description: 'Lead parado no funil há mais de 7 dias',
            phone: '5519999993333',
            reason: 'STALE_PIPELINE',
          },
        ],
        totalCount: 3,
      },
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it('renders tab counts and task items', () => {
    render(
      <MemoryRouter>
        <CrmDailyFocus />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Ligar para retorno comercial/i)).toBeInTheDocument();
    expect(screen.getByText(/Padaria Alfa/i)).toBeInTheDocument();
  });

  it('switches to hot leads tab and triggers WhatsApp outreach callback', async () => {
    const user = userEvent.setup();
    const handleSelectForWhatsApp = vi.fn();

    render(
      <MemoryRouter>
        <CrmDailyFocus onSelectLeadForWhatsApp={handleSelectForWhatsApp} />
      </MemoryRouter>,
    );

    // Switch to hot leads tab
    const hotTab = screen.getByRole('button', { name: /Leads Quentes sem Contato/i });
    await user.click(hotTab);

    expect(screen.getByText('Clínica Sorriso')).toBeInTheDocument();

    // Click WhatsApp button
    const buttons = screen.getAllByRole('button');
    const whatsappBtn = buttons.find((btn) => btn.querySelector('svg.lucide-message-circle'));
    expect(whatsappBtn).toBeDefined();
    await user.click(whatsappBtn!);

    expect(handleSelectForWhatsApp).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'lead-2',
        companyName: 'Clínica Sorriso',
      }),
    );
  });
});

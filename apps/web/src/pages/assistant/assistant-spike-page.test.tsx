import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { AssistantSpikePage } from './assistant-spike-page';

const mockUseAssistantSpike = vi.fn();
vi.mock('@/features/assistant/useAssistantSpike', () => ({
  useAssistantSpike: () => mockUseAssistantSpike(),
}));

describe('AssistantSpikePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders disabled message when VITE_ASSISTANT_SPIKE is not true', () => {
    vi.stubEnv('VITE_ASSISTANT_SPIKE', 'false');
    mockUseAssistantSpike.mockReturnValue({
      messages: [],
      status: 'idle',
      error: null,
      pendingIntent: null,
      sendMessage: vi.fn(),
      stop: vi.fn(),
      decideAction: vi.fn(),
      clearMessages: vi.fn(),
    });

    renderWithProviders(<AssistantSpikePage />, { withGoogle: false });

    expect(screen.getByText('Assistente experimental desativado')).toBeInTheDocument();
    expect(screen.getByText(/VITE_ASSISTANT_SPIKE=false/)).toBeInTheDocument();
  });

  it('renders chat interface in Portuguese with term "cliente" (never "lead") when enabled', () => {
    vi.stubEnv('VITE_ASSISTANT_SPIKE', 'true');
    mockUseAssistantSpike.mockReturnValue({
      messages: [
        { id: '1', role: 'user', content: 'Quantos clientes temos?' },
        { id: '2', role: 'assistant', content: 'Você possui 12 clientes cadastrados.' },
      ],
      status: 'idle',
      error: null,
      pendingIntent: null,
      sendMessage: vi.fn(),
      stop: vi.fn(),
      decideAction: vi.fn(),
      clearMessages: vi.fn(),
    });

    renderWithProviders(<AssistantSpikePage />, { withGoogle: false });

    expect(screen.getByText('Assistente de Clientes')).toBeInTheDocument();
    expect(screen.getByText('Quantos clientes temos?')).toBeInTheDocument();
    expect(screen.getByText('Você possui 12 clientes cadastrados.')).toBeInTheDocument();

    // Verify UI says "cliente", not "lead"
    expect(screen.queryByText(/lead/i)).not.toBeInTheDocument();
  });

  it('displays approval card with approve and reject buttons when pendingIntent is present', async () => {
    vi.stubEnv('VITE_ASSISTANT_SPIKE', 'true');
    const mockDecide = vi.fn();
    mockUseAssistantSpike.mockReturnValue({
      messages: [],
      status: 'awaiting_approval',
      error: null,
      pendingIntent: {
        intentId: 'intent-123',
        customerId: 'cust-1',
        customerName: 'Oficina Central',
        action: 'schedule_followup',
        summary: 'Agendar follow-up para próxima semana',
        message: 'Confirme o agendamento de contato',
      },
      sendMessage: vi.fn(),
      stop: vi.fn(),
      decideAction: mockDecide,
      clearMessages: vi.fn(),
    });

    const user = userEvent.setup();
    renderWithProviders(<AssistantSpikePage />, { withGoogle: false });

    expect(screen.getByText('Aprovação do operador necessária')).toBeInTheDocument();
    expect(screen.getByText('Confirme o agendamento de contato')).toBeInTheDocument();
    expect(screen.getByText(/Oficina Central/)).toBeInTheDocument();

    const approveBtn = screen.getByRole('button', { name: /Aprovar ação/i });
    const rejectBtn = screen.getByRole('button', { name: /Rejeitar ação/i });

    expect(approveBtn).toBeInTheDocument();
    expect(rejectBtn).toBeInTheDocument();

    await user.click(approveBtn);
    expect(mockDecide).toHaveBeenCalledWith('approve');
  });

  it('shows Parar button during streaming and invokes stop when clicked', async () => {
    vi.stubEnv('VITE_ASSISTANT_SPIKE', 'true');
    const mockStop = vi.fn();
    mockUseAssistantSpike.mockReturnValue({
      messages: [{ id: '1', role: 'user', content: 'Pergunta' }],
      status: 'streaming',
      error: null,
      pendingIntent: null,
      sendMessage: vi.fn(),
      stop: mockStop,
      decideAction: vi.fn(),
      clearMessages: vi.fn(),
    });

    const user = userEvent.setup();
    renderWithProviders(<AssistantSpikePage />, { withGoogle: false });

    const stopBtn = screen.getByRole('button', { name: /Parar/i });
    expect(stopBtn).toBeInTheDocument();

    await user.click(stopBtn);
    expect(mockStop).toHaveBeenCalledTimes(1);
  });
});

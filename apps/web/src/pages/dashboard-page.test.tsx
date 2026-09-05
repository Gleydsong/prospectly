import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/features/theme/theme-provider';
import { LeadStatus } from '@/types';
import { DashboardPage } from './dashboard-page';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector: (s: { user: { name: string } }) => unknown) =>
    selector({ user: { name: 'Mariana Silva' } }),
}));

vi.mock('@/features/dashboard/api', () => ({
  fetchDashboardSummary: vi.fn(async () => ({
    totalLeads: 42,
    newLeads: 31,
    qualified: 5,
    contacted: 3,
    meetings: 2,
    proposals: 1,
    won: 3,
    lost: 0,
    conversionRate: 0.1,
    overdueTasks: 0,
    overdueFollowUps: [],
    upcomingFollowUps: [],
    topOpportunities: [],
    conversionBySource: [],
  })),
}));

vi.mock('@/features/leads/hooks', () => ({
  useLeads: vi.fn(() => ({
    isLoading: false,
    data: {
      data: [
        {
          id: 'lead-1',
          companyName: 'Padaria Estrela Solar',
          segment: 'Panificação e Confeitaria',
          city: 'Campinas - SP',
          email: 'contato@padariaestrela.com.br',
          phone: '+551999887766',
          status: LeadStatus.NEW,
          score: 84,
          source: 'GOOGLE_PLACES',
          doNotContact: false,
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'lead-2',
          companyName: 'Boutique Flor de Lis',
          segment: 'Moda Feminina',
          city: 'São Paulo - SP',
          email: 'vendas@flordelis.com.br',
          phone: null,
          status: LeadStatus.WON,
          score: 95,
          source: 'MANUAL',
          doNotContact: false,
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      meta: {
        total: 42,
        page: 1,
        pageSize: 10,
        pageCount: 5,
      },
    },
  })),
}));

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders greeting, headline and commercial action CTAs', async () => {
    renderDashboard();

    expect(screen.getByText(/aqui está o que precisa da sua atenção hoje/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prospectar novos leads/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver acompanhamentos/i })).toBeInTheDocument();
  });

  it('renders the 3 horizontal KPI cards with big metrics and badges', async () => {
    renderDashboard();

    expect((await screen.findAllByText('31')).length).toBeGreaterThan(0);
    expect(screen.getByText(/prioridade alta/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filtrar novos/i })).toBeInTheDocument();

    expect(screen.getByText(/contatados hoje/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /meta diária/i })).toBeInTheDocument();

    expect(screen.getByText(/em dia ✓/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver pendências/i })).toBeInTheDocument();
  });

  it('renders table toolbar with constrained search, action buttons, and status counts', () => {
    renderDashboard();

    expect(screen.getByRole('textbox', { name: /buscar por nome/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filtros/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /importar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exportar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /novo cliente/i })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /^todos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^novos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^contatados/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^qualificados/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^fechados/i })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /lista/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /kanban/i })).toBeInTheDocument();
  });

  it('renders company avatar initials, niche subtitle, city, status badge and contextual lead score in rows', () => {
    renderDashboard();

    expect(screen.getByText('PE')).toBeInTheDocument();
    expect(screen.getByText('Padaria Estrela Solar')).toBeInTheDocument();
    expect(screen.getByText('Panificação e Confeitaria')).toBeInTheDocument();
    expect(screen.getByText('Campinas - SP')).toBeInTheDocument();

    expect(screen.getByText('84/100')).toBeInTheDocument();
    expect(screen.getAllByText('Alto')).toHaveLength(2);

    const emailLinks = screen.getAllByRole('link', { name: /enviar e-mail/i });
    expect(emailLinks.length).toBeGreaterThan(0);
    expect(emailLinks[0]).toHaveAttribute('href', 'mailto:contato@padariaestrela.com.br');

    const phoneLinks = screen.getAllByRole('link', { name: /ligar para/i });
    expect(phoneLinks.length).toBeGreaterThan(0);
    expect(phoneLinks[0]).toHaveAttribute('href', 'tel:+551999887766');

    const openButtons = screen.getAllByRole('link', { name: /^abrir$/i });
    expect(openButtons[0]).toHaveAttribute('href', '/leads/lead-1');
  });

  it('navigates when commercial CTAs and toolbar buttons are clicked', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole('button', { name: /prospectar novos leads/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/search');

    await user.click(screen.getByRole('button', { name: /ver acompanhamentos/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/tasks');

    await user.click(screen.getByRole('button', { name: /novo cliente/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/leads');
  });
});

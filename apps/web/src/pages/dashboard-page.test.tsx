import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { fetchDashboardSummary } from '@/features/dashboard/api';
import { createActivity, fetchClientMap } from '@/features/leads/api';
import { renderWithProviders } from '@/test/render';
import { LeadStatus, type DashboardSummary } from '@/types';
import { useCreateActivity } from '@/features/leads/hooks';
import { DashboardPage } from './dashboard-page';

vi.mock('@/features/dashboard/api', () => ({
  fetchDashboardSummary: vi.fn(),
  fetchDashboardCharts: vi.fn(),
}));
vi.mock('@/features/leads/api', () => ({ fetchClientMap: vi.fn(), createActivity: vi.fn() }));
vi.mock('@/features/leads/components/client-map-canvas', () => ({
  default: ({
    data,
    compact,
    dark,
    onError,
    onViewport,
    onSelect,
  }: {
    data?: { pins: Array<{ id: string; name: string }> };
    compact?: boolean;
    dark: boolean;
    onError: () => void;
    onViewport: (bbox: string) => void;
    onSelect: (id: string) => void;
  }) => (
    <div data-testid="map" data-compact={compact} data-dark={dark}>
      {data?.pins.map((pin) => (
        <button key={pin.id} onClick={() => onSelect(pin.id)}>
          {pin.name}
        </button>
      ))}
      <button onClick={onError}>Tile failure</button>
      <button onClick={() => onViewport('-10,20,10,40')}>Move map</button>
    </div>
  ),
}));
vi.mock('@/features/leads/components/lead-form-modal', () => ({
  LeadFormModal: () => <div role="dialog">Create client form</div>,
}));

function summary(): DashboardSummary {
  return {
    totalLeads: 23,
    newLeads: 23,
    contacted: 7,
    qualified: 4,
    won: 2,
    overview: {
      nextActions: [
        {
          id: 'task1',
          title: 'Realizar acompanhamento',
          dueAt: '2026-10-20T09:00:00Z',
          lead: { id: 'c1', companyName: 'Café Ativo' },
        },
      ],
      byStatus: [
        { status: LeadStatus.NEW, count: 19 },
        { status: LeadStatus.QUALIFIED, count: 4 },
      ],
      periodDays: 30,
      currentPeriod: { start: '2026-09-21', end: '2026-10-21' },
      previousPeriod: { start: '2026-08-22', end: '2026-09-21' },
      kpis: {
        clients: { value: 23, previousValue: 20, changePercent: 15 },
        contacted: { value: 7, previousValue: 10, changePercent: -30 },
        qualified: { value: 4, previousValue: 0, changePercent: null },
        won: { value: 2, previousValue: 2, changePercent: 0 },
      },
      dailyCreated: [
        { date: '2026-10-19', count: 9 },
        { date: '2026-10-20', count: 14 },
      ],
      recentActivity: [
        {
          id: 'a1',
          type: 'CALL',
          description: null,
          outcome: null,
          createdAt: '2026-10-20T10:00:00Z',
          lead: { id: 'c1', companyName: 'Café Ativo' },
          user: { id: 'u1', name: 'Ana' },
        },
      ],
    },
    overdueFollowUps: [
      { id: 'c1', companyName: 'Café Ativo', nextContactAt: '2026-10-20T09:00:00Z' },
    ],
    upcomingFollowUps: [],
  } as DashboardSummary;
}

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('pt');
  vi.mocked(fetchDashboardSummary).mockResolvedValue(summary());
  vi.mocked(fetchClientMap).mockResolvedValue({
    pins: [
      { id: 'saved1', name: 'Cliente salvo', latitude: 0, longitude: 0, status: LeadStatus.NEW },
    ],
    clusters: [],
    meta: { total: 1, grouped: false, limit: 500 },
  });
});
afterEach(() => {
  document.documentElement.classList.remove('dark');
});

describe('Início #363', () => {
  it('renders all four API KPIs and variations, with no fabricated baseline or daily target', async () => {
    const { container } = renderWithProviders(<DashboardPage />);
    const clients = screen.getByLabelText('Clientes');
    expect(await within(clients).findByText('23')).toBeInTheDocument();
    expect(within(clients).getByText('+15% vs. período anterior')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Contatados')).getByText('7')).toBeInTheDocument();
    expect(screen.getByText('-30% vs. período anterior')).toBeInTheDocument();
    expect(screen.getByText('Sem base no período anterior')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Ganhos')).getByText('2')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\bleads?\b|10\/dia/i);
    expect(fetchDashboardSummary).toHaveBeenCalledWith({ period: '30d' });
  });

  it('shares the saved-client map without period filtering and links to Clientes > Mapa', async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Cliente salvo')).toBeInTheDocument();
    expect(fetchClientMap).toHaveBeenCalledWith(
      { bbox: '-180,-90,180,90' },
      expect.any(AbortSignal),
    );
    expect(screen.getByTestId('map')).toHaveAttribute('data-compact', 'true');
    expect(screen.getByRole('link', { name: /ver no mapa/i })).toHaveAttribute(
      'href',
      '/clientes?vista=mapa',
    );
    await userEvent.click(screen.getByText('Move map'));
    await waitFor(() =>
      expect(fetchClientMap).toHaveBeenLastCalledWith(
        { bbox: '-10,20,10,40' },
        expect.any(AbortSignal),
      ),
    );
  });

  it('renders real distribution, daily evolution, next actions and recent activity', async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByRole('list', { name: 'Distribuição por etapa' })).toHaveTextContent(
      '19',
    );
    expect(screen.getByRole('table', { name: 'Evolução de clientes' })).toHaveTextContent('9');
    expect(screen.getByRole('table', { name: 'Evolução de clientes' })).toHaveTextContent('14');
    expect(screen.getAllByRole('link', { name: /café ativo/i })).toHaveLength(2);
    expect(screen.getByText('Ligação')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver todas/i })).toHaveAttribute('href', '/tasks');
  });

  it('renders up to five API-scheduled tasks including tasks without an associated client', async () => {
    const data = summary();
    data.overview!.nextActions = Array.from({ length: 5 }, (_, i) => ({
      id: `task${i}`,
      title: `Tarefa ${i}`,
      dueAt: `2026-10-${21 + i}T09:00:00Z`,
      lead: i === 4 ? null : { id: `client${i}`, companyName: `Cliente ${i}` },
    }));
    vi.mocked(fetchDashboardSummary).mockResolvedValue(data);
    renderWithProviders(<DashboardPage />);
    await screen.findByText('Cliente 3');
    expect(screen.queryByText('Cliente 4')).not.toBeInTheDocument();
    expect(screen.getByText('Tarefa 4')).toBeInTheDocument();
    expect(screen.getByText('Tarefa agendada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cliente 0/i })).toHaveAttribute('href', '/tasks');
  });

  it('shows loading states while API data is unavailable, without presenting zeros', () => {
    vi.mocked(fetchDashboardSummary).mockReturnValue(new Promise(() => {}));
    vi.mocked(fetchClientMap).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<DashboardPage />);
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(within(screen.getByLabelText('Clientes')).getByText('…')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows empty states and true API zeros without inventing actions', async () => {
    const data = summary();
    for (const metric of Object.values(data.overview!.kpis)) metric.value = 0;
    data.overview!.dailyCreated = [{ date: '2026-10-20', count: 0 }];
    data.overview!.recentActivity = [];
    data.overdueFollowUps = [];
    data.overview!.nextActions = [];
    vi.mocked(fetchDashboardSummary).mockResolvedValue(data);
    data.overview!.byStatus = [];
    vi.mocked(fetchClientMap).mockResolvedValue({
      pins: [],
      clusters: [],
      meta: { total: 0, grouped: false, limit: 500 },
    });
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Nenhuma tarefa agendada.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma atividade recente.')).toBeInTheDocument();
    expect(screen.getAllByText('Nenhum cliente neste período.')).toHaveLength(2);
    expect(within(screen.getByLabelText('Clientes')).getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/nenhum cliente com localização/i)).toBeInTheDocument();
  });

  it('shows recoverable API errors and dashes instead of fabricated totals', async () => {
    vi.mocked(fetchDashboardSummary).mockRejectedValue(new Error('offline'));
    vi.mocked(fetchClientMap).mockRejectedValue(new Error('offline'));
    renderWithProviders(<DashboardPage />);
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    expect(within(screen.getByLabelText('Clientes')).getAllByText('—')).toHaveLength(2);
    vi.mocked(fetchDashboardSummary).mockResolvedValue(summary());
    await userEvent.click(screen.getAllByRole('button', { name: /tentar novamente/i })[0]!);
    expect(await within(screen.getByLabelText('Clientes')).findByText('23')).toBeInTheDocument();
  });

  it('reports tile failure and retains navigation to the complete map', async () => {
    renderWithProviders(<DashboardPage />);
    await userEvent.click(await screen.findByText('Tile failure'));
    expect(screen.getByRole('alert')).toHaveTextContent(/mapa/i);
    expect(screen.getByRole('link', { name: /ver no mapa/i })).toBeInTheDocument();
  });

  it('uses the dark theme and translated English client vocabulary', async () => {
    document.documentElement.classList.add('dark');
    await i18n.changeLanguage('en');
    const { container } = renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Stage distribution')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveAttribute('data-dark', 'true');
    expect(container.textContent).not.toMatch(/\bleads?\b/i);
    expect(screen.getByRole('link', { name: /view on map/i })).toBeInTheDocument();
  });

  it('refreshes recent activity after registering a client interaction', async () => {
    const updated = summary();
    updated.overview!.recentActivity[0]!.type = 'MEETING';
    vi.mocked(fetchDashboardSummary).mockResolvedValueOnce(summary()).mockResolvedValue(updated);
    vi.mocked(createActivity).mockResolvedValue({} as Awaited<ReturnType<typeof createActivity>>);
    function Interaction() {
      const mutation = useCreateActivity('c1');
      return (
        <>
          <DashboardPage />
          <button onClick={() => mutation.mutate({ type: 'MEETING' })}>Record meeting</button>
        </>
      );
    }
    renderWithProviders(<Interaction />);
    expect(await screen.findByText('Ligação')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Record meeting' }));
    expect(await screen.findByText('Reunião')).toBeInTheDocument();
    expect(fetchDashboardSummary).toHaveBeenCalledTimes(2);
  });

  it('opens the existing client creation form', async () => {
    renderWithProviders(<DashboardPage />);
    await userEvent.click(screen.getByRole('button', { name: /novo cliente/i }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Create client form');
  });
});

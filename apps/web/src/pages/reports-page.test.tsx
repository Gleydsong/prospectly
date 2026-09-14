import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import { Role } from '@/types';

import { ReportsPage } from './reports-page';

const mocks = vi.hoisted(() => ({
  useFunnelConversion: vi.fn(),
  useSavedReports: vi.fn(),
  useCreateSavedReport: vi.fn(),
  useArchiveSavedReport: vi.fn(),
}));

vi.mock('@/features/reports/hooks', () => ({
  useFunnelConversion: (...args: unknown[]) => mocks.useFunnelConversion(...args),
  useSavedReports: () => mocks.useSavedReports(),
  useCreateSavedReport: () => mocks.useCreateSavedReport(),
  useArchiveSavedReport: () => mocks.useArchiveSavedReport(),
}));

function setUser(role: Role = Role.OWNER) {
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'a@b.com',
      name: 'Ana',
      role,
      emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      organizationId: 'org1',
      organizationName: 'Acme',
      locale: 'pt',
    },
    accessToken: 'token',
    bootstrapped: true,
  });
}

describe('ReportsPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    vi.clearAllMocks();
    setUser();
    mocks.useFunnelConversion.mockReturnValue({
      data: {
        period: '30d',
        periodStart: '2026-01-29T12:00:00.000Z',
        inflow: 4,
        wins: 1,
        losses: 1,
        winRate: 50,
        bySource: [
          { source: 'MANUAL', inflow: 3, wins: 1, losses: 0, winRate: 100 },
          { source: 'GOOGLE_PLACES', inflow: 1, wins: 0, losses: 1, winRate: 0 },
        ],
      },
      isLoading: false,
      isError: false,
    });
    mocks.useSavedReports.mockReturnValue({ data: [], isLoading: false, isError: false });
    mocks.useCreateSavedReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });
    mocks.useArchiveSavedReport.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('shows funnel conversion KPIs and the 90-day outbox notice', () => {
    renderWithProviders(<ReportsPage />, { withGoogle: false });
    expect(screen.getByRole('heading', { name: 'Relatórios' })).toBeInTheDocument();
    expect(screen.getByText(/retenção do outbox \(90 dias\)/i)).toBeInTheDocument();
    expect(screen.getByText(/eventos antigos \(v1\)/i)).toBeInTheDocument();
    expect(screen.getAllByText('Entradas').length).toBeGreaterThan(0);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getAllByText('Manual').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Guardar Relatório salvo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /publicar/i })).not.toBeInTheDocument();
  });

  it('opens the wins bucket in Clientes and does not navigate empty cells', () => {
    renderWithProviders(<ReportsPage />, { withGoogle: false });
    expect(screen.getByRole('link', { name: 'Ver Ganhos (1)' })).toHaveAttribute(
      'href',
      '/leads?reportBucket=wins&period=30d',
    );
    expect(screen.getByRole('link', { name: 'Ver Entradas (4)' })).toHaveAttribute(
      'href',
      '/leads?reportBucket=inflow&period=30d',
    );
    expect(screen.getByRole('link', { name: 'Ver Ganhos · Manual (1)' })).toHaveAttribute(
      'href',
      '/leads?reportBucket=wins&period=30d&source=MANUAL',
    );
    expect(screen.queryByRole('link', { name: /Taxa de ganho/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver Ganhos · Google Places (0)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver Perdas · Manual (0)' })).not.toBeInTheDocument();
  });

  it('lets VIEWER follow a bucket without mutate controls', () => {
    setUser(Role.VIEWER);
    renderWithProviders(<ReportsPage />, { withGoogle: false });
    expect(screen.getByRole('heading', { name: 'Relatórios' })).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver Ganhos (1)' })).toHaveAttribute(
      'href',
      '/leads?reportBucket=wins&period=30d',
    );
    expect(screen.queryByRole('button', { name: 'Guardar Relatório salvo' })).not.toBeInTheDocument();
  });

  it('requests a new period when the filter changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportsPage />, { withGoogle: false });
    await user.selectOptions(screen.getByLabelText('Período'), '7d');
    expect(mocks.useFunnelConversion).toHaveBeenCalledWith(
      expect.objectContaining({ period: '7d' }),
      expect.anything(),
    );
  });

  it('defaults SALES to their own book and still lets them see the org', async () => {
    setUser(Role.SALES);
    const user = userEvent.setup();
    renderWithProviders(<ReportsPage />, { withGoogle: false });
    expect(mocks.useFunnelConversion).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'u1' }),
      expect.anything(),
    );
    expect(screen.getByRole('link', { name: 'Ver Ganhos (1)' })).toHaveAttribute(
      'href',
      '/leads?reportBucket=wins&period=30d&ownerId=u1',
    );
    await user.click(screen.getByLabelText('Só os meus clientes'));
    expect(mocks.useFunnelConversion).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: undefined }),
      expect.anything(),
    );
  });

  it('lists Relatórios salvos without mixing them with Vistas', () => {
    mocks.useSavedReports.mockReturnValue({
      data: [
        {
          id: 'rep-1',
          name: '30d Google',
          ownerId: 'u1',
          definition: { period: '30d', source: 'GOOGLE_PLACES' },
          archivedAt: null,
          createdAt: '2026-09-12T00:00:00.000Z',
          updatedAt: '2026-09-12T00:00:00.000Z',
          canEdit: true,
        },
      ],
      isLoading: false,
      isError: false,
    });
    renderWithProviders(<ReportsPage />, { withGoogle: false });
    expect(screen.getByText('Relatórios salvos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30d Google' })).toBeInTheDocument();
    expect(screen.queryByText(/Vista salva/i)).not.toBeInTheDocument();
  });

  it('asks the viewer to try again when Relatórios times out', () => {
    mocks.useFunnelConversion.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: Object.assign(new Error('Relatórios indisponível'), {
        isAxiosError: true,
        response: { data: { code: 'REPORTS_QUERY_TIMEOUT' } },
      }),
    });
    renderWithProviders(<ReportsPage />, { withGoogle: false });
    expect(screen.getByText('Relatórios indisponível. Tente de novo.')).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível carregar o relatório.')).not.toBeInTheDocument();
  });
});

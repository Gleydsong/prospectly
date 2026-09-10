import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import { Role } from '@/types';

import { ReportsPage } from './reports-page';

const mocks = vi.hoisted(() => ({
  useFunnelConversion: vi.fn(),
}));

vi.mock('@/features/reports/hooks', () => ({
  useFunnelConversion: (...args: unknown[]) => mocks.useFunnelConversion(...args),
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
  });

  it('shows funnel conversion KPIs and the 90-day outbox notice', () => {
    renderWithProviders(<ReportsPage />, { withGoogle: false });
    expect(screen.getByRole('heading', { name: 'Relatórios' })).toBeInTheDocument();
    expect(screen.getByText(/retenção do outbox \(90 dias\)/i)).toBeInTheDocument();
    expect(screen.getAllByText('Entradas').length).toBeGreaterThan(0);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getAllByText('Manual').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /guardar|salvar|publicar/i })).not.toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: /guardar|salvar|publicar|criar/i })).not.toBeInTheDocument();
  });

  it('requests a new period when the filter changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportsPage />, { withGoogle: false });
    await user.selectOptions(screen.getByLabelText('Período'), '7d');
    expect(mocks.useFunnelConversion).toHaveBeenCalledWith(
      expect.objectContaining({ period: '7d' }),
    );
  });

  it('defaults SALES to their own book and still lets them see the org', async () => {
    setUser(Role.SALES);
    const user = userEvent.setup();
    renderWithProviders(<ReportsPage />, { withGoogle: false });
    expect(mocks.useFunnelConversion).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'u1' }),
    );
    expect(screen.getByRole('link', { name: 'Ver Ganhos (1)' })).toHaveAttribute(
      'href',
      '/leads?reportBucket=wins&period=30d&ownerId=u1',
    );
    await user.click(screen.getByLabelText('Só os meus clientes'));
    expect(mocks.useFunnelConversion).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: undefined }),
    );
  });

  it('shows a recoverable Relatórios error without treating overload as a generic 500', async () => {
    const refetch = vi.fn();
    const error = new AxiosError('fail');
    error.response = {
      status: 503,
      data: { code: 'REPORTS_QUERY_TIMEOUT', message: 'Relatórios indisponível. Tente de novo.' },
      statusText: 'Service Unavailable',
      headers: {},
      config: {} as never,
    };
    mocks.useFunnelConversion.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error,
      refetch,
    });

    const user = userEvent.setup();
    renderWithProviders(<ReportsPage />, { withGoogle: false });

    expect(screen.getByRole('alert')).toHaveTextContent('Relatórios indisponível. Tente de novo.');
    expect(screen.queryByText('Não foi possível carregar o relatório.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

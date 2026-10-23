import { screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/stores/auth.store';
import { Role } from '@/types';
import { Sidebar } from './sidebar';

const { mockUseBillingStatus } = vi.hoisted(() => ({
  mockUseBillingStatus: vi.fn(),
}));

vi.mock('./today-summary', () => ({ TodaySummary: () => <div>Resumo de hoje</div> }));

vi.mock('@/features/billing/hooks', () => ({
  useBillingStatus: () => mockUseBillingStatus(),
}));

describe('Sidebar persona tag and redesign', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('pt');
  });

  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    mockUseBillingStatus.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        plan: 'FREE',
        planStatus: 'INACTIVE',
        freeSearchLimit: 3,
        creditBalance: 312,
      },
    });

    useAuthStore.setState({
      accessToken: 'token',
      bootstrapped: true,
      user: {
        id: 'u1',
        name: 'Ana',
        email: 'ana@example.com',
        organizationId: 'org-1',
        organizationName: 'Acme',
        role: Role.OWNER,
        locale: 'pt',
        defaultPersona: 'vendedor',
        personaOverride: null,
        effectivePersona: 'vendedor',
        personaOtherLabel: null,
        personaOnboardedAt: '2026-09-14T00:00:00.000Z',
      },
    });
  });

  it('shows the organization Outro label under the login name', () => {
    useAuthStore.setState((state) => ({
      ...state,
      user: state.user
        ? {
            ...state.user,
            defaultPersona: 'outro',
            effectivePersona: 'outro',
            personaOtherLabel: 'Fotógrafo',
          }
        : null,
    }));

    renderWithProviders(
      <Sidebar
        open
        onClose={() => undefined}
        isDesktop
        collapsed={false}
        onCollapse={() => undefined}
      />,
      { withGoogle: false },
    );

    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Fotógrafo')).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
  });

  it('shows the translated persona and renders workspace and tools links', () => {
    renderWithProviders(
      <Sidebar
        open
        onClose={() => undefined}
        isDesktop
        collapsed={false}
        onCollapse={() => undefined}
      />,
      { withGoogle: false },
    );

    expect(screen.getByText('Vendedor')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Prospectar' })).toHaveAttribute('href', '/prospectar');
    expect(screen.getByRole('link', { name: 'SDR' })).toHaveAttribute('href', '/sdr');
    expect(screen.getByRole('link', { name: /comprar mais/i })).toHaveAttribute('href', '/credits');
    expect(screen.getByText('312')).toBeInTheDocument();
    expect(screen.getByText('créditos restantes')).toBeInTheDocument();
    expect(screen.getByText('Resumo de hoje')).toBeInTheDocument();
    expect(screen.queryByText('Fotógrafo')).not.toBeInTheDocument();
  });

  it('renders a skeleton for credit balance while billing is loading', () => {
    mockUseBillingStatus.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    });

    renderWithProviders(
      <Sidebar
        open
        onClose={() => undefined}
        isDesktop
        collapsed={false}
        onCollapse={() => undefined}
      />,
      { withGoogle: false },
    );

    expect(screen.getByTestId('sidebar-credits-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('renders "—" with an honest error label when billing fails in pt and en', async () => {
    mockUseBillingStatus.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
    });

    await i18n.changeLanguage('pt');
    const { unmount } = renderWithProviders(
      <Sidebar
        open
        onClose={() => undefined}
        isDesktop
        collapsed={false}
        onCollapse={() => undefined}
      />,
      { withGoogle: false },
    );

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Não foi possível carregar o saldo')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-credits-skeleton')).not.toBeInTheDocument();
    unmount();

    await i18n.changeLanguage('en');
    renderWithProviders(
      <Sidebar
        open
        onClose={() => undefined}
        isDesktop
        collapsed={false}
        onCollapse={() => undefined}
      />,
      { withGoogle: false },
    );

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Could not load balance')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('renders 0 honestly when the user actually has 0 credits remaining', () => {
    mockUseBillingStatus.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        creditBalance: 0,
      },
    });

    renderWithProviders(
      <Sidebar
        open
        onClose={() => undefined}
        isDesktop
        collapsed={false}
        onCollapse={() => undefined}
      />,
      { withGoogle: false },
    );

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('créditos restantes')).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-credits-skeleton')).not.toBeInTheDocument();
  });

  it('points the Relatórios item to /?aba=relatorios', () => {
    renderWithProviders(
      <Sidebar
        open
        onClose={() => undefined}
        isDesktop
        collapsed={false}
        onCollapse={() => undefined}
      />,
      { withGoogle: false },
    );

    expect(screen.getByRole('link', { name: 'Relatórios' })).toHaveAttribute(
      'href',
      '/?aba=relatorios',
    );
  });

  it('only activates "Listas" on /clientes/listas, not "Clientes"', () => {
    renderWithProviders(
      <Sidebar
        open
        onClose={() => undefined}
        isDesktop
        collapsed={false}
        onCollapse={() => undefined}
      />,
      { initialEntries: ['/clientes/listas'], withGoogle: false },
    );

    const listasLink = screen.getByRole('link', { name: 'Listas' });
    const clientesLink = screen.getByRole('link', { name: 'Clientes' });

    expect(listasLink).toHaveAttribute('aria-current', 'page');
    expect(clientesLink).not.toHaveAttribute('aria-current');
  });

  it('only activates "Clientes" on /clientes, not "Listas"', () => {
    renderWithProviders(
      <Sidebar
        open
        onClose={() => undefined}
        isDesktop
        collapsed={false}
        onCollapse={() => undefined}
      />,
      { initialEntries: ['/clientes'], withGoogle: false },
    );

    const clientesLink = screen.getByRole('link', { name: 'Clientes' });
    const listasLink = screen.getByRole('link', { name: 'Listas' });

    expect(clientesLink).toHaveAttribute('aria-current', 'page');
    expect(listasLink).not.toHaveAttribute('aria-current');
  });

  it('only activates "Relatórios" on /?aba=relatorios, not "Início"', () => {
    renderWithProviders(
      <Sidebar
        open
        onClose={() => undefined}
        isDesktop
        collapsed={false}
        onCollapse={() => undefined}
      />,
      { initialEntries: ['/?aba=relatorios'], withGoogle: false },
    );

    const relatoriosLink = screen.getByRole('link', { name: 'Relatórios' });
    const inicioLink = screen.getByRole('link', { name: 'Início' });

    expect(relatoriosLink).toHaveAttribute('aria-current', 'page');
    expect(inicioLink).not.toHaveAttribute('aria-current');
  });
});

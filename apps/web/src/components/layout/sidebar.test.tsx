import { screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/stores/auth.store';
import { Role } from '@/types';
import { Sidebar } from './sidebar';

vi.mock('./today-summary', () => ({ TodaySummary: () => <div>Resumo de hoje</div> }));

vi.mock('@/features/billing/hooks', () => ({
  useBillingStatus: () => ({
    data: {
      plan: 'FREE',
      planStatus: 'INACTIVE',
      freeSearchLimit: 3,
      creditBalance: 312,
    },
  }),
}));

describe('Sidebar persona tag and redesign', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('pt');
  });

  beforeEach(() => {
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
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import { Role } from '@/types';
import { SettingsPage } from './settings-page';

const updateOrganizationName = vi.fn();
const fetchOrganizationMembers = vi.fn();
const fetchCurrentOrganization = vi.fn();

vi.mock('@/features/auth/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth/api')>('@/features/auth/api');
  return {
    ...actual,
    getProfile: vi.fn().mockResolvedValue({
      id: 'u1',
      name: 'Marina Costa',
      email: 'marina@nortedigital.com.br',
      role: 'OWNER',
      emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    }),
  };
});

vi.mock('@/features/organizations/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/organizations/api')>(
    '@/features/organizations/api',
  );
  return {
    ...actual,
    updateOrganizationName: (...args: unknown[]) => updateOrganizationName(...args),
    fetchOrganizationMembers: () => fetchOrganizationMembers(),
    fetchCurrentOrganization: () => fetchCurrentOrganization(),
  };
});

vi.mock('@/features/google-connections/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/google-connections/api')>(
    '@/features/google-connections/api',
  );
  return {
    ...actual,
    fetchOrgGoogleConnections: vi.fn().mockResolvedValue([]),
    fetchMyGoogleConnection: vi.fn().mockResolvedValue(null),
    revokeGoogleConnection: vi.fn(),
  };
});

describe('SettingsPage', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('pt');
    updateOrganizationName.mockReset();
    fetchOrganizationMembers.mockReset();
    fetchCurrentOrganization.mockReset();

    fetchCurrentOrganization.mockResolvedValue({
      id: 'org1',
      name: 'Agência Norte Digital',
      defaultPersona: 'vendedor',
      personaOtherLabel: null,
    });

    fetchOrganizationMembers.mockResolvedValue([
      {
        id: 'm1',
        role: Role.OWNER,
        user: { id: 'u1', name: 'Marina Costa', email: 'marina@nortedigital.com.br' },
      },
      {
        id: 'm2',
        role: Role.MEMBER,
        user: { id: 'u2', name: 'Rafael Lima', email: 'rafael@nortedigital.com.br' },
      },
      {
        id: 'm3',
        role: Role.VIEWER,
        user: { id: 'u3', name: 'Júlia Santos', email: 'julia@nortedigital.com.br' },
      },
    ]);

    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'marina@nortedigital.com.br',
        name: 'Marina Costa',
        role: Role.OWNER,
        emailVerifiedAt: '2026-01-01T00:00:00.000Z',
        organizationId: 'org1',
        organizationName: 'Agência Norte Digital',
        locale: 'pt',
      } as never,
      accessToken: 'token',
      bootstrapped: true,
    });
  });

  it('renders organization and members sections matching 06-configuracoes.png', async () => {
    renderWithProviders(<SettingsPage />, {
      initialEntries: ['/settings'],
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Configurações' })).toBeInTheDocument();
    expect(screen.getByText('Perfil, organização, equipe e preferências.')).toBeInTheDocument();

    // Check organization card
    expect(screen.getByRole('heading', { level: 2, name: 'Organização' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Nome')).toHaveValue('Agência Norte Digital');
    expect(screen.getByLabelText('Persona padrão')).toBeInTheDocument();
    expect(screen.getByLabelText('Fuso horário')).toBeInTheDocument();
    expect(screen.getByLabelText('Idioma')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument();

    // Check members card
    expect(screen.getByRole('heading', { level: 2, name: 'Usuários e permissões' })).toBeInTheDocument();
    expect(await screen.findByText('3 MEMBROS')).toBeInTheDocument();
    expect(screen.getByText('Marina Costa')).toBeInTheDocument();
    expect(screen.getByText('Rafael Lima')).toBeInTheDocument();
    expect(screen.getByText('Júlia Santos')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('email@empresa.com.br')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Convidar' })).toBeInTheDocument();
  });

  it('lets user change organization name and save', async () => {
    const user = userEvent.setup();
    updateOrganizationName.mockResolvedValue({ id: 'org1', name: 'Agência Nova' });

    renderWithProviders(<SettingsPage />, {
      initialEntries: ['/settings'],
    });

    const nameInput = await screen.findByLabelText('Nome');
    await user.clear(nameInput);
    await user.type(nameInput, 'Agência Nova');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(updateOrganizationName).toHaveBeenCalledWith('Agência Nova');
  });
});

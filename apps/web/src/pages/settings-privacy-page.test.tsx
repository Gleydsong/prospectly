import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import { SettingsPrivacyPage } from './settings-privacy-page';

const downloadPrivacyExport = vi.fn();
const deletePrivacyAccount = vi.fn();

vi.mock('@/features/auth/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth/api')>('@/features/auth/api');
  return {
    ...actual,
    downloadPrivacyExport: () => downloadPrivacyExport(),
    deletePrivacyAccount: () => deletePrivacyAccount(),
  };
});

describe('SettingsPrivacyPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    downloadPrivacyExport.mockReset();
    deletePrivacyAccount.mockReset();

    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'ana@agency.dev',
        name: 'Ana',
        role: 'OWNER',
        emailVerifiedAt: '2026-01-01T00:00:00.000Z',
        organizationId: 'org1',
        organizationName: 'Agência Norte Digital',
        locale: 'pt',
      } as never,
      accessToken: 'token',
      bootstrapped: true,
    });
  });

  it('renders processors, data actions and banner correctly', () => {
    renderWithProviders(<SettingsPrivacyPage />, {
      initialEntries: ['/settings/privacy'],
    });

    expect(screen.getByText('Processadores de IA')).toBeInTheDocument();
    expect(screen.getByText('Cloudflare Workers AI')).toBeInTheDocument();
    expect(screen.getByText('Groq')).toBeInTheDocument();
    expect(screen.getByText('Laya')).toBeInTheDocument();

    expect(screen.getByText('Seus dados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exportar dados/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pedido de acesso/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apagar conta/ })).toBeInTheDocument();

    expect(screen.getByText('Nada é enviado sem o seu clique.')).toBeInTheDocument();
    expect(screen.getByTestId('signal-ring')).toBeInTheDocument();
  });

  it('triggers data export on click', async () => {
    const user = userEvent.setup();
    downloadPrivacyExport.mockResolvedValue({});

    renderWithProviders(<SettingsPrivacyPage />, {
      initialEntries: ['/settings/privacy'],
    });

    await user.click(screen.getByRole('button', { name: /Exportar dados/ }));
    expect(downloadPrivacyExport).toHaveBeenCalled();
  });
});

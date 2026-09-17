import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';

import { IntegrationsSettingsCard } from './integrations-settings-card';

const mocks = vi.hoisted(() => ({
  fetchPluginTokens: vi.fn(),
  createPluginToken: vi.fn(),
  revokePluginToken: vi.fn(),
  fetchMcpConnections: vi.fn(),
  revokeMcpConnection: vi.fn(),
}));

vi.mock('@/features/integrations/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/integrations/api')>();
  return {
    ...actual,
    fetchPluginTokens: () => mocks.fetchPluginTokens(),
    createPluginToken: (name: string) => mocks.createPluginToken(name),
    revokePluginToken: (id: string) => mocks.revokePluginToken(id),
    fetchMcpConnections: () => mocks.fetchMcpConnections(),
    revokeMcpConnection: (id: string) => mocks.revokeMcpConnection(id),
  };
});

describe('IntegrationsSettingsCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    vi.clearAllMocks();
    mocks.fetchPluginTokens.mockResolvedValue([]);
    mocks.fetchMcpConnections.mockResolvedValue([]);
  });

  it('shows PluginToken controls and hides the outbound webhook card', async () => {
    renderWithProviders(<IntegrationsSettingsCard canManage />, { withGoogle: false });

    expect(await screen.findByRole('button', { name: 'Gerar chave' })).toBeInTheDocument();
    expect(screen.getByText('Plugins e conexões')).toBeInTheDocument();
    expect(screen.getByText('Ligações MCP')).toBeInTheDocument();
    expect(screen.getByText(/\/mcp/)).toBeInTheDocument();
    expect(screen.queryByLabelText('URL do webhook')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar webhook' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rotar segredo' })).not.toBeInTheDocument();
    expect(screen.queryByText('Webhook de saída')).not.toBeInTheDocument();
    expect(screen.queryByText('Entregas')).not.toBeInTheDocument();
  });

  it('hides Integrações when the user cannot manage the org', () => {
    const { container } = renderWithProviders(<IntegrationsSettingsCard canManage={false} />, {
      withGoogle: false,
    });
    expect(container).toBeEmptyDOMElement();
    expect(mocks.fetchPluginTokens).not.toHaveBeenCalled();
    expect(mocks.fetchMcpConnections).not.toHaveBeenCalled();
  });

  it('lists MCP connections and revokes them', async () => {
    mocks.fetchMcpConnections.mockResolvedValue([
      {
        id: 'conn-1',
        clientName: 'Cursor Desktop',
        createdAt: '2026-09-16T00:00:00.000Z',
        lastUsedAt: null,
      },
    ]);
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderWithProviders(<IntegrationsSettingsCard canManage />, { withGoogle: false });
    expect(await screen.findByText('Cursor Desktop')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revogar ligação' }));
    expect(mocks.revokeMcpConnection).toHaveBeenCalledWith('conn-1');
  });
});

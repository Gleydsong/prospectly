import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';

import { IntegrationsSettingsCard } from './integrations-settings-card';

const mocks = vi.hoisted(() => ({
  fetchPluginTokens: vi.fn(),
  createPluginToken: vi.fn(),
  revokePluginToken: vi.fn(),
}));

vi.mock('@/features/integrations/api', () => ({
  fetchPluginTokens: () => mocks.fetchPluginTokens(),
  createPluginToken: (name: string) => mocks.createPluginToken(name),
  revokePluginToken: (id: string) => mocks.revokePluginToken(id),
}));

describe('IntegrationsSettingsCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    vi.clearAllMocks();
    mocks.fetchPluginTokens.mockResolvedValue([]);
  });

  it('shows PluginToken controls and hides the outbound webhook card', async () => {
    renderWithProviders(<IntegrationsSettingsCard canManage />, { withGoogle: false });

    expect(await screen.findByRole('button', { name: 'Gerar chave' })).toBeInTheDocument();
    expect(screen.getByText('Plugins e conexões')).toBeInTheDocument();
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
  });
});

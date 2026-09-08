import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';

import { IntegrationsSettingsCard } from './integrations-settings-card';

const mocks = vi.hoisted(() => ({
  fetchIntegrations: vi.fn(),
  fetchPluginTokens: vi.fn(),
  fetchWebhookDeliveries: vi.fn(),
  upsertWebhookIntegration: vi.fn(),
  rotateWebhookSecret: vi.fn(),
  createPluginToken: vi.fn(),
  revokePluginToken: vi.fn(),
}));

vi.mock('@/features/integrations/api', () => ({
  fetchIntegrations: () => mocks.fetchIntegrations(),
  fetchPluginTokens: () => mocks.fetchPluginTokens(),
  fetchWebhookDeliveries: () => mocks.fetchWebhookDeliveries(),
  upsertWebhookIntegration: (input: unknown) => mocks.upsertWebhookIntegration(input),
  rotateWebhookSecret: () => mocks.rotateWebhookSecret(),
  createPluginToken: (name: string) => mocks.createPluginToken(name),
  revokePluginToken: (id: string) => mocks.revokePluginToken(id),
}));

describe('IntegrationsSettingsCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    vi.clearAllMocks();
    mocks.fetchPluginTokens.mockResolvedValue([]);
    mocks.fetchIntegrations.mockResolvedValue([]);
    mocks.fetchWebhookDeliveries.mockResolvedValue([]);
  });

  it('flashes the signing secret once after first save', async () => {
    mocks.upsertWebhookIntegration.mockResolvedValue({
      id: 'int-1',
      provider: 'WEBHOOK',
      status: 'ENABLED',
      url: 'https://hooks.example.com/prospectly',
      label: null,
      hasSigningSecret: true,
      signingSecret: 'plwhsec_once',
      createdAt: '2026-09-08T00:00:00.000Z',
      updatedAt: '2026-09-08T00:00:00.000Z',
    });
    const user = userEvent.setup();
    renderWithProviders(<IntegrationsSettingsCard canManage />, { withGoogle: false });

    await user.type(
      await screen.findByLabelText('URL do webhook'),
      'https://hooks.example.com/prospectly',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar webhook' }));

    expect(await screen.findByText('plwhsec_once')).toBeInTheDocument();
    expect(screen.getByText(/não será mostrado de novo/i)).toBeInTheDocument();
  });

  it('does not show a signing secret on GET hydration', async () => {
    mocks.fetchIntegrations.mockResolvedValue([
      {
        id: 'int-1',
        provider: 'WEBHOOK',
        status: 'ENABLED',
        url: 'https://hooks.example.com/prospectly',
        label: 'CRM',
        hasSigningSecret: true,
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
      },
    ]);
    renderWithProviders(<IntegrationsSettingsCard canManage />, { withGoogle: false });

    expect(await screen.findByDisplayValue('https://hooks.example.com/prospectly')).toBeInTheDocument();
    expect(screen.queryByText(/plwhsec_/)).not.toBeInTheDocument();
    expect(screen.getByText('Segredo de assinatura configurado.')).toBeInTheDocument();
  });

  it('shows Omissão instead of Enviado and never renders payload', async () => {
    mocks.fetchWebhookDeliveries.mockResolvedValue([
      {
        id: 'evt-1',
        type: 'lead.created',
        createdAt: '2026-09-08T12:00:00.000Z',
        status: 'PROCESSED',
        attempts: 1,
        lastError: null,
        skipReason: 'no_active_webhook',
        processedAt: '2026-09-08T12:00:01.000Z',
        payload: { email: 'secret@example.test' },
      },
    ]);
    renderWithProviders(<IntegrationsSettingsCard canManage />, { withGoogle: false });

    expect(await screen.findByText('lead.created')).toBeInTheDocument();
    expect(screen.getByText(/Omissão/)).toBeInTheDocument();
    expect(screen.queryByText('Enviado')).not.toBeInTheDocument();
    expect(screen.queryByText('secret@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText(/payload/i)).not.toBeInTheDocument();
  });

  it('rotates the signing secret from the Integrações card', async () => {
    mocks.fetchIntegrations.mockResolvedValue([
      {
        id: 'int-1',
        provider: 'WEBHOOK',
        status: 'ENABLED',
        url: 'https://hooks.example.com/prospectly',
        label: null,
        hasSigningSecret: true,
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
      },
    ]);
    mocks.rotateWebhookSecret.mockResolvedValue({
      id: 'int-1',
      provider: 'WEBHOOK',
      status: 'ENABLED',
      url: 'https://hooks.example.com/prospectly',
      label: null,
      hasSigningSecret: true,
      signingSecret: 'plwhsec_rotated',
      createdAt: '2026-09-08T00:00:00.000Z',
      updatedAt: '2026-09-08T00:00:01.000Z',
    });
    const user = userEvent.setup();
    renderWithProviders(<IntegrationsSettingsCard canManage />, { withGoogle: false });

    await user.click(await screen.findByRole('button', { name: 'Rotar segredo' }));
    expect(mocks.rotateWebhookSecret).toHaveBeenCalled();
    expect(await screen.findByText('plwhsec_rotated')).toBeInTheDocument();
  });

  it('hides the Integrações webhook card when the user cannot manage the org', () => {
    const { container } = renderWithProviders(<IntegrationsSettingsCard canManage={false} />, {
      withGoogle: false,
    });
    expect(container).toBeEmptyDOMElement();
    expect(mocks.fetchIntegrations).not.toHaveBeenCalled();
  });
});

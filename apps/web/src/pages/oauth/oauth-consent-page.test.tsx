import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { OauthConsentPage } from './oauth-consent-page';

const mocks = vi.hoisted(() => ({
  fetchAuthorizableOrgs: vi.fn(),
  submitOauthConsent: vi.fn(),
  assignOauthClientRedirect: vi.fn(),
}));

vi.mock('@/features/oauth/api', () => ({
  fetchAuthorizableOrgs: () => mocks.fetchAuthorizableOrgs(),
  submitOauthConsent: (input: unknown) => mocks.submitOauthConsent(input),
}));

vi.mock('@/lib/safe-url', () => ({
  assignOauthClientRedirect: (redirect: string, expected: string) =>
    mocks.assignOauthClientRedirect(redirect, expected),
}));

const CONSENT_PATH =
  '/oauth/consent?client_id=c1&redirect_uri=http%3A%2F%2F127.0.0.1%3A10000%2Fcb&code_challenge=abc&code_challenge_method=S256&resource=http://127.0.0.1:3000/mcp&state=xyz';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/oauth/consent" element={<OauthConsentPage />} />
    </Routes>,
    { initialEntries: [CONSENT_PATH], withGoogle: false },
  );
}

describe('OauthConsentPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    vi.clearAllMocks();
    mocks.fetchAuthorizableOrgs.mockResolvedValue([
      { id: 'org-owner', name: 'Acme' },
      { id: 'org-admin', name: 'Beta' },
    ]);
    mocks.submitOauthConsent.mockResolvedValue({
      redirect: 'http://127.0.0.1:10000/cb?error=access_denied&state=xyz',
    });
  });

  it('shows the real role of each authorizable organization', async () => {
    mocks.fetchAuthorizableOrgs.mockResolvedValue([
      { id: 'org-owner', name: 'Acme', role: 'OWNER' },
      { id: 'org-admin', name: 'Beta', role: 'ADMIN' },
    ]);
    renderPage();
    expect(await screen.findByText('Proprietária')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
  });

  it('describes only the read-only scopes the MCP server exposes', async () => {
    renderPage();
    expect(await screen.findByText('Ler clientes, sem contatos nem notas')).toBeInTheDocument();
    expect(screen.getByText('Não pode alterar nem apagar dados')).toBeInTheDocument();
    expect(screen.queryByText(/etapas|histórico/)).not.toBeInTheDocument();
  });

  it('lists only OWNER/ADMIN orgs returned by the API', async () => {
    renderPage();
    expect(await screen.findByRole('option', { name: 'Acme' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /viewer/i })).not.toBeInTheDocument();
  });

  it('posts access_denied when the user refuses', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('option', { name: 'Acme' });
    await user.click(screen.getByRole('button', { name: 'Recusar' }));
    await waitFor(() => expect(mocks.submitOauthConsent).toHaveBeenCalled());
    expect(mocks.submitOauthConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'deny',
        organizationId: 'org-owner',
        client_id: 'c1',
      }),
    );
    expect(mocks.assignOauthClientRedirect).toHaveBeenCalledWith(
      'http://127.0.0.1:10000/cb?error=access_denied&state=xyz',
      'http://127.0.0.1:10000/cb',
    );
  });
});

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { ProtectedRoute } from './protected-route';
import { Role, type AuthUser } from '@/types';
import { useAuthStore } from '@/stores/auth.store';

const bootstrapSession = vi.fn();

vi.mock('@/lib/api', () => ({
  bootstrapSession: (...args: unknown[]) => bootstrapSession(...args),
}));

const user: AuthUser = {
  id: 'u1',
  name: 'Ana',
  email: 'ana@example.com',
  organizationId: 'org-1',
  organizationName: 'Acme',
  role: Role.OWNER,
  locale: 'pt',
  personaOnboardedAt: '2026-01-01T00:00:00.000Z',
  defaultPersona: 'vendedor',
  personaOverride: null,
  effectivePersona: 'vendedor',
};

function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return <div>Tela de login from={from}</div>;
}

function renderProtected(initialPath = '/') {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route index element={<div>Area logada</div>} />
          <Route path="/onboarding/persona" element={<div>Onboarding persona</div>} />
          <Route path="/oauth/consent" element={<div>Consentimento MCP</div>} />
        </Route>
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    bootstrapSession.mockReset();
    useAuthStore.setState({ user: null, accessToken: null, bootstrapped: false });
  });

  it('renders the protected outlet after a restored session', async () => {
    bootstrapSession.mockImplementation(async () => {
      useAuthStore.setState({ user, accessToken: 'restored-token', bootstrapped: true });
      return true;
    });

    renderProtected();

    expect(await screen.findByText('Area logada')).toBeInTheDocument();
    expect(bootstrapSession).toHaveBeenCalledTimes(1);
  });

  it('redirects to login when refresh cannot restore the session', async () => {
    bootstrapSession.mockImplementation(async () => {
      useAuthStore.setState({ user: null, accessToken: null, bootstrapped: true });
      return false;
    });

    renderProtected();

    expect(await screen.findByText(/Tela de login/)).toBeInTheDocument();
  });

  it('preserves the OAuth consent query string on the login return path', async () => {
    bootstrapSession.mockImplementation(async () => {
      useAuthStore.setState({ user: null, accessToken: null, bootstrapped: true });
      return false;
    });

    renderProtected('/oauth/consent?client_id=c1&state=xyz');

    expect(
      await screen.findByText('Tela de login from=/oauth/consent?client_id=c1&state=xyz'),
    ).toBeInTheDocument();
  });

  it('skips persona onboarding while authorizing an MCP connection', async () => {
    bootstrapSession.mockImplementation(async () => {
      useAuthStore.setState({
        user: { ...user, personaOnboardedAt: null },
        accessToken: 'restored-token',
        bootstrapped: true,
      });
      return true;
    });

    renderProtected('/oauth/consent?client_id=c1');

    expect(await screen.findByText('Consentimento MCP')).toBeInTheDocument();
  });

  it('redirects OWNER without persona onboarding to /onboarding/persona', async () => {
    bootstrapSession.mockImplementation(async () => {
      useAuthStore.setState({
        user: { ...user, personaOnboardedAt: null },
        accessToken: 'restored-token',
        bootstrapped: true,
      });
      return true;
    });

    renderProtected();

    expect(await screen.findByText('Onboarding persona')).toBeInTheDocument();
  });
});

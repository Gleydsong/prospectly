import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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
};

function renderProtected() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route index element={<div>Area logada</div>} />
        </Route>
        <Route path="/login" element={<div>Tela de login</div>} />
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

    expect(await screen.findByText('Tela de login')).toBeInTheDocument();
  });
});

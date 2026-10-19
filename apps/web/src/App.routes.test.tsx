import { screen } from '@testing-library/react';
import { Outlet } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { App } from './App';

vi.mock('@/components/layout/app-layout', () => ({ AppLayout: () => <Outlet /> }));
vi.mock('@/components/protected-route', () => ({ ProtectedRoute: () => <Outlet /> }));
vi.mock('@/pages/campaigns-page', () => ({ CampaignsPage: () => <h1>Listas de clientes</h1> }));
vi.mock('@/pages/leads/lead-detail-page', () => ({
  LeadDetailPage: () => <h1>Ficha de cliente incorreta</h1>,
}));

describe('Clients routes', () => {
  it('routes /clientes/listas to client lists instead of treating listas as a client id', async () => {
    renderWithProviders(<App />, { initialEntries: ['/clientes/listas'], withGoogle: false });
    expect(await screen.findByRole('heading', { name: 'Listas de clientes' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Ficha de cliente incorreta' }),
    ).not.toBeInTheDocument();
  });
});

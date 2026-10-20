import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Outlet } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { App } from './App';
import { useLocation } from 'react-router-dom';

vi.mock('@/components/layout/app-layout', () => ({ AppLayout: () => <Outlet /> }));
vi.mock('@/components/protected-route', () => ({ ProtectedRoute: () => <Outlet /> }));
vi.mock('@/pages/campaigns-page', () => ({ CampaignsPage: () => <h1>Listas de clientes</h1> }));
vi.mock('@/pages/leads/lead-detail-page', () => ({
  LeadDetailPage: () => <h1>Ficha de cliente incorreta</h1>,
}));
vi.mock('@/pages/pipeline-page', () => ({ PipelinePage: () => <h1>Etapas do pipeline</h1> }));
vi.mock('@/pages/leads/leads-page', () => ({ LeadsPage: () => <h1>Clientes</h1> }));

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  );
}

describe('Clients routes', () => {
  it('routes /clientes/listas to client lists instead of treating listas as a client id', async () => {
    renderWithProviders(<App />, { initialEntries: ['/clientes/listas'], withGoogle: false });
    expect(await screen.findByRole('heading', { name: 'Listas de clientes' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Ficha de cliente incorreta' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the old pipeline reachable at /clientes/etapas and redirects /pipeline with URL state', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <App />
        <LocationProbe />
      </>,
      {
        initialEntries: ['/pipeline?filtro=quente#etapa'],
        withGoogle: false,
      },
    );
    expect(await screen.findByRole('heading', { name: 'Etapas do pipeline' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/clientes/etapas?filtro=quente#etapa',
    );
    await user.click(screen.getByRole('link', { name: 'Voltar aos clientes' }));
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
  });
});

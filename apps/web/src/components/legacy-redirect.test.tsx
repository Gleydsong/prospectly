import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Outlet, useLocation } from 'react-router-dom';
import { App } from '@/App';
import { renderWithProviders } from '@/test/render';

vi.mock('@/components/protected-route', () => ({ ProtectedRoute: () => <Outlet /> }));
vi.mock('@/components/layout/app-layout', () => ({ AppLayout: () => <Outlet /> }));
function Destination() {
  const location = useLocation();
  return (
    <p>
      {location.pathname}
      {location.search}
      {location.hash}
    </p>
  );
}
vi.mock('@/pages/navigation-pages', () => ({
  HomeDestination: () => <Destination />,
  ProspectDestination: () => <Destination />,
  ClientsDestination: () => <Destination />,
}));
vi.mock('@/pages/leads/lead-detail-page', () => ({ LeadDetailPage: () => <Destination /> }));
vi.mock('@/pages/campaign-detail-page', () => ({ CampaignDetailPage: () => <Destination /> }));

describe('Legacy routes in the authenticated app', () => {
  it.each([
    ['/tools', '/prospectar'],
    ['/tools/opportunity-finder', '/prospectar?aba=servico'],
    ['/search', '/prospectar?aba=categoria'],
    ['/imports', '/prospectar?aba=importar'],
    ['/leads', '/clientes'],
    ['/leads/client-123', '/clientes/client-123'],
    ['/pipeline', '/clientes?vista=quadro'],
    ['/campaigns', '/clientes?vista=listas'],
    ['/campaigns/list-123', '/clientes/listas/list-123'],
    ['/reports', '/'],
    [
      '/leads?reportBucket=wins&period=30d#results',
      '/clientes?reportBucket=wins&period=30d#results',
    ],
    ['/pipeline?vista=lista&q=Acme', '/clientes?vista=quadro&q=Acme'],
  ])('redirects %s to %s', async (from, to) => {
    renderWithProviders(<App />, { initialEntries: [from], withGoogle: false });
    expect(await screen.findByText(to)).toBeInTheDocument();
  });
});

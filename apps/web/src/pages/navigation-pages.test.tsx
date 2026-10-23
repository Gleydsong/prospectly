import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { HomeDestination, ProspectDestination } from './navigation-pages';

vi.mock('./dashboard-page', () => ({ DashboardPage: () => <p>Home dashboard</p> }));
vi.mock('./reports-page', () => ({ ReportsPage: () => <p>Reports tab</p> }));
vi.mock('./search-page', () => ({ SearchPage: () => <p>Category search</p> }));
vi.mock('./opportunity-finder-page', () => ({
  OpportunityFinderPage: ({ embedded }: { embedded?: boolean }) => (
    <p>{embedded ? 'Embedded AI search' : 'Standalone AI search'}</p>
  ),
}));
vi.mock('./imports-page', () => ({
  ImportsPage: ({ embedded }: { embedded?: boolean }) => (
    <p>{embedded ? 'Embedded CSV import' : 'Standalone CSV import'}</p>
  ),
}));
function Location() {
  return <output data-testid="url">{useLocation().search}</output>;
}

describe('home destinations', () => {
  it('opens the Relatórios tab for /?aba=relatorios and the dashboard otherwise', async () => {
    const { unmount } = renderWithProviders(<HomeDestination />, {
      initialEntries: ['/?aba=relatorios'],
    });
    expect(await screen.findByText('Reports tab')).toBeInTheDocument();
    expect(screen.queryByText('Home dashboard')).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<HomeDestination />, { initialEntries: ['/'] });
    expect(await screen.findByText('Home dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Reports tab')).not.toBeInTheDocument();
  });
});

describe('unified prospecting destinations', () => {
  it('switches the three existing flows while preserving city and state query parameters', async () => {
    renderWithProviders(
      <>
        <ProspectDestination />
        <Location />
      </>,
      { initialEntries: ['/prospectar?city=Recife&state=PE&country=BR'] },
    );
    expect(await screen.findByText('Category search')).toBeInTheDocument();
    const service = screen.getByRole('link', { name: 'Por serviço com IA' });
    await userEvent.click(service);
    expect(await screen.findByText('Embedded AI search')).toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent(
      'city=Recife&state=PE&country=BR&aba=servico',
    );
    await userEvent.click(screen.getByRole('link', { name: 'Importar CSV' }));
    expect(await screen.findByText('Embedded CSV import')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Por categoria' }));
    expect(await screen.findByText('Category search')).toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent(
      'city=Recife&state=PE&country=BR&aba=categoria',
    );
  });
});

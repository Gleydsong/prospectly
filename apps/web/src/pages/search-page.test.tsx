import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchPage } from './search-page';

const mocks = vi.hoisted(() => ({
  createSearch: vi.fn(),
  deleteSearch: vi.fn(),
  importResults: vi.fn(),
  useSearches: vi.fn(),
  useSearch: vi.fn(),
  useSearchResults: vi.fn(),
  useSearchProviders: vi.fn(),
  useProspectingCategories: vi.fn(),
  useGeoRegions: vi.fn(),
  useGeoCities: vi.fn(),
  useBillingStatus: vi.fn(),
}));

vi.mock('@/features/prospecting/hooks', () => ({
  useSearches: mocks.useSearches,
  useSearch: mocks.useSearch,
  useSearchResults: mocks.useSearchResults,
  useSearchProviders: mocks.useSearchProviders,
  useProspectingCategories: mocks.useProspectingCategories,
  useGeoRegions: mocks.useGeoRegions,
  useGeoCities: mocks.useGeoCities,
  useCreateSearch: () => ({ mutateAsync: mocks.createSearch, isPending: false }),
  useDeleteSearch: () => ({
    mutateAsync: mocks.deleteSearch,
    isPending: false,
    variables: undefined as string | undefined,
  }),
  useImportSearchResults: () => ({ mutateAsync: mocks.importResults, isPending: false }),
}));

vi.mock('@/features/billing/hooks', () => ({
  BILLING_STATUS_QUERY_KEY: ['billing', 'status'],
  useBillingStatus: mocks.useBillingStatus,
}));

function Wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function renderPage() {
  return render(<SearchPage />, { wrapper: Wrapper });
}

function processingSearch(status: 'PROCESSING' | 'FAILED' | 'COMPLETED' = 'PROCESSING') {
  return {
    data: {
      data: [
        {
          id: 'search-1',
          provider: 'OPENSTREETMAP',
          input: {
            categories: ['restaurant'],
            category: 'restaurant',
            city: 'São Paulo',
            state: 'SP',
            country: 'BR',
            onlyWithoutWebsite: true,
          },
          status,
          error: status === 'FAILED' ? 'falhou' : undefined,
          createdAt: '2026-07-22T10:00:00.000Z',
          completedAt: null,
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSearchProviders.mockReturnValue({
      data: [
        { id: 'OPENSTREETMAP', label: 'OpenStreetMap', available: true },
        { id: 'GOOGLE_PLACES', label: 'Google Places', available: true },
      ],
      isLoading: false,
      isError: false,
    });
    mocks.useProspectingCategories.mockReturnValue({
      data: {
        plan: 'FREE',
        requiredPlan: 'STARTER_MONTHLY',
        total: 3,
        availableCount: 2,
        categories: [
          { value: 'restaurant', label: 'Restaurante', available: true },
          { value: 'bakery', label: 'Padaria', available: true },
          { value: 'lawyer', label: 'Advocacia', available: false },
        ],
      },
      isLoading: false,
      isError: false,
    });
    mocks.useBillingStatus.mockReturnValue({
      data: {
        plan: 'FREE',
        searchUsage: { used: 2, limit: 3, remaining: 1, unlimited: false },
      },
      isLoading: false,
      isError: false,
    });
    mocks.useGeoRegions.mockImplementation((country?: string) => ({
      data:
        country === 'PT'
          ? [{ code: '11', name: 'Lisbon' }]
          : country === 'BR'
            ? [{ code: 'SP', name: 'São Paulo' }, { code: 'RJ', name: 'Rio de Janeiro' }]
            : [],
      isLoading: false,
      isError: false,
      error: null,
    }));
    mocks.useGeoCities.mockImplementation((country?: string, region?: string) => ({
      data:
        country === 'BR' && region === 'SP'
          ? [{ name: 'São Paulo' }, { name: 'Campinas' }]
          : country === 'PT' && region === '11'
            ? [{ name: 'Lisbon' }, { name: 'Amadora' }]
            : [],
      isLoading: false,
      isError: false,
      error: null,
    }));
    mocks.useSearches.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.useSearch.mockReturnValue({ data: undefined });
    mocks.useSearchResults.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    });
  });

  it('requires niche, region and city before submitting', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Pesquisar empresas' }));

    expect(await screen.findByText('Selecione pelo menos um nicho')).toBeInTheDocument();
    expect(mocks.createSearch).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText('Nicho'), 'restaurant');
    await user.click(screen.getByRole('button', { name: 'Pesquisar empresas' }));

    expect(await screen.findByText('Selecione uma região')).toBeInTheDocument();
    expect(screen.getByText('Selecione uma cidade')).toBeInTheDocument();
    expect(mocks.createSearch).not.toHaveBeenCalled();
  });

  it('shows the plan search quota and locked niches', () => {
    renderPage();

    expect(screen.getByText('2 / 3 buscas')).toBeInTheDocument();
    expect(screen.getByText('2 de 3 nichos disponíveis no plano Gratuito')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Advocacia/ })).toBeDisabled();
  });

  it('submits multiple niches with neighborhood and requested volume', async () => {
    const user = userEvent.setup();
    mocks.createSearch.mockResolvedValue({ id: 'search-1' });
    renderPage();

    expect(
      screen.getByRole('checkbox', { name: 'Somente empresas sem site informado' }),
    ).not.toBeChecked();
    await user.selectOptions(screen.getByLabelText('Nicho'), 'restaurant');
    await user.selectOptions(screen.getByLabelText('Nicho'), 'bakery');
    await user.selectOptions(screen.getByLabelText('Região'), 'SP');
    await user.selectOptions(screen.getByLabelText('Cidade'), 'São Paulo');
    await user.type(screen.getByLabelText('Bairro (opcional)'), 'Pinheiros');
    await user.click(screen.getByRole('button', { name: '40' }));
    await user.click(screen.getByRole('button', { name: 'Pesquisar empresas' }));

    expect(mocks.createSearch).toHaveBeenCalledWith({
      categories: ['restaurant', 'bakery'],
      city: 'São Paulo',
      neighborhood: 'Pinheiros',
      state: 'SP',
      country: 'BR',
      provider: 'OPENSTREETMAP',
      onlyWithoutWebsite: false,
      limit: 40,
    });
  });

  it('removes a selected niche from the search', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByLabelText('Nicho'), 'restaurant');
    expect(screen.getByRole('button', { name: 'Remover Restaurante' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remover Restaurante' }));
    expect(screen.queryByRole('button', { name: 'Remover Restaurante' })).not.toBeInTheDocument();
  });

  it('shows country in search history labels', () => {
    mocks.useSearches.mockReturnValue({
      data: {
        data: [
          {
            id: 'search-pt',
            provider: 'OPENSTREETMAP',
            input: {
              category: 'restaurant',
              city: 'Lisbon',
              state: 'Lisbon',
              country: 'PT',
              onlyWithoutWebsite: true,
            },
            status: 'COMPLETED',
            error: null,
            createdAt: '2026-07-22T10:00:00.000Z',
            completedAt: '2026-07-22T10:01:00.000Z',
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();

    expect(screen.getByText(/Restaurante \/ Lisbon/)).toBeInTheDocument();
    expect(screen.getByText(/Brasil e na Europa/)).toBeInTheDocument();
    expect(screen.queryByText(/OPENSTREETMAP|GOOGLE_PLACES/)).not.toBeInTheDocument();
  });

  it('cascades country to region and city selects for Portugal', async () => {
    const user = userEvent.setup();
    mocks.createSearch.mockResolvedValue({ id: 'search-pt' });
    renderPage();

    await user.selectOptions(screen.getByLabelText('País'), 'PT');
    expect(screen.getByLabelText('Região')).toBeInTheDocument();
    expect(screen.getByLabelText('Cidade')).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Nicho'), 'restaurant');
    await user.selectOptions(screen.getByLabelText('Região'), '11');
    expect(screen.getByLabelText('Cidade')).not.toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Cidade'), 'Lisbon');
    await user.click(screen.getByRole('button', { name: 'Pesquisar empresas' }));

    expect(mocks.createSearch).toHaveBeenCalledWith({
      categories: ['restaurant'],
      city: 'Lisbon',
      state: 'Lisbon',
      country: 'PT',
      provider: 'OPENSTREETMAP',
      onlyWithoutWebsite: false,
      limit: 20,
    });
  });

  it('shows a safe API error when search creation fails', async () => {
    const user = userEvent.setup();
    mocks.createSearch.mockRejectedValue(new Error('offline'));
    renderPage();

    await user.selectOptions(screen.getByLabelText('Nicho'), 'restaurant');
    await user.selectOptions(screen.getByLabelText('Região'), 'SP');
    await user.selectOptions(screen.getByLabelText('Cidade'), 'São Paulo');
    await user.click(screen.getByRole('button', { name: 'Pesquisar empresas' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocorreu um erro inesperado.');
  });

  it('deletes a history item after confirmation and keeps leads note in the prompt', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.deleteSearch.mockResolvedValue(undefined);
    mocks.useSearches.mockReturnValue(processingSearch('FAILED'));
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Apagar pesquisa Restaurante / São Paulo' }));

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('Leads já importados permanecem'),
    );
    expect(mocks.deleteSearch).toHaveBeenCalledWith('search-1');
    confirmSpy.mockRestore();
  });

  it('shows a retriable error instead of an empty history when history loading fails', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mocks.useSearches.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('offline'),
      refetch,
    });
    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o histórico de pesquisas.',
    );
    expect(screen.queryByText('Nenhuma pesquisa')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it('shows a retriable error instead of an empty result grid when result loading fails', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mocks.useSearches.mockReturnValue(processingSearch());
    mocks.useSearch.mockReturnValue({ data: undefined });
    mocks.useSearchResults.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('offline'),
      isPlaceholderData: false,
      refetch,
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: /^Restaurante \/ São Paulo/ }));

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os resultados.');
    expect(screen.queryByText('Nenhum resultado encontrado')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it('shows OpenStreetMap attribution and blocks CRM sending until processing completes', async () => {
    const user = userEvent.setup();
    mocks.useSearches.mockReturnValue(processingSearch());
    mocks.useSearchResults.mockReturnValue({
      data: {
        data: [
          {
            id: 'result-1',
            data: {
              externalId: 'node/1',
              companyName: 'Empresa em processamento',
              city: 'São Paulo',
              state: 'SP',
              country: 'BR',
              source: 'OPENSTREETMAP',
              websitePresence: 'NO_WEBSITE_REPORTED',
            },
            normalizedData: {
              externalId: 'node/1',
              companyName: 'Empresa em processamento',
              city: 'São Paulo',
              state: 'SP',
              country: 'BR',
              source: 'OPENSTREETMAP',
              websitePresence: 'NO_WEBSITE_REPORTED',
            },
            websitePresence: 'NO_WEBSITE_REPORTED',
            importedLeadId: null,
            createdAt: '2026-07-22T10:00:00.000Z',
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: /^Restaurante \/ São Paulo/ }));

    const attribution = screen.getByRole('link', { name: 'colaboradores do OpenStreetMap' });
    expect(attribution).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
    expect(
      screen.getByRole('checkbox', { name: 'Selecionar Empresa em processamento' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Enviar para CRM (0)' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Enviar para CRM' })[0]).toBeDisabled();
  });

  it('sends a single result to the CRM from its card', async () => {
    const user = userEvent.setup();
    mocks.importResults.mockResolvedValue({
      imported: 1,
      skipped: 0,
      invalid: 0,
      conflicts: 0,
      items: [],
    });
    mocks.useSearches.mockReturnValue(processingSearch('COMPLETED'));
    mocks.useSearch.mockReturnValue({ data: undefined });
    mocks.useSearchResults.mockReturnValue({
      data: {
        data: [
          {
            id: 'result-1',
            data: {
              externalId: 'node/1',
              companyName: 'Barbearia Nacuca',
              city: 'Olinda',
              state: 'PE',
              country: 'BR',
              phone: '(81) 99863-9994',
              source: 'OPENSTREETMAP',
              websitePresence: 'NO_WEBSITE_REPORTED',
            },
            normalizedData: {
              externalId: 'node/1',
              companyName: 'Barbearia Nacuca',
              city: 'Olinda',
              state: 'PE',
              country: 'BR',
              phone: '(81) 99863-9994',
              source: 'OPENSTREETMAP',
              websitePresence: 'NO_WEBSITE_REPORTED',
            },
            websitePresence: 'NO_WEBSITE_REPORTED',
            importedLeadId: null,
            createdAt: '2026-07-22T10:00:00.000Z',
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: /^Restaurante \/ São Paulo/ }));
    expect(screen.getByText('Sem site')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Enviar para CRM' })[0]!);

    expect(mocks.importResults).toHaveBeenCalledWith({
      searchId: 'search-1',
      resultIds: ['result-1'],
    });
  });
});

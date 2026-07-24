import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
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
  useGeoRegions: vi.fn(),
  useGeoCities: vi.fn(),
}));

vi.mock('@/features/prospecting/hooks', () => ({
  useSearches: mocks.useSearches,
  useSearch: mocks.useSearch,
  useSearchResults: mocks.useSearchResults,
  useSearchProviders: mocks.useSearchProviders,
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

function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

function renderPage() {
  return render(<SearchPage />, { wrapper: Wrapper });
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

  it('requires category, region and city before submitting', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Pesquisar empresas' }));

    expect(await screen.findByText('Selecione pelo menos uma categoria')).toBeInTheDocument();
    expect(mocks.createSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('checkbox', { name: 'Restaurante' }));
    await user.click(screen.getByRole('button', { name: 'Pesquisar empresas' }));

    expect(await screen.findByText('Selecione uma região')).toBeInTheDocument();
    expect(screen.getByText('Selecione uma cidade')).toBeInTheDocument();
    expect(mocks.createSearch).not.toHaveBeenCalled();
  });

  it('keeps the no-website filter enabled by default and submits multiple categories', async () => {
    const user = userEvent.setup();
    mocks.createSearch.mockResolvedValue({ id: 'search-1' });
    renderPage();

    expect(screen.getByRole('checkbox', { name: 'Somente empresas sem site informado' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Restaurante' }));
    await user.click(screen.getByRole('checkbox', { name: 'Padaria' }));
    await user.selectOptions(screen.getByLabelText('Região'), 'SP');
    await user.selectOptions(screen.getByLabelText('Cidade'), 'São Paulo');
    await user.click(screen.getByRole('button', { name: 'Pesquisar empresas' }));

    expect(mocks.createSearch).toHaveBeenCalledWith({
      categories: ['restaurant', 'bakery'],
      city: 'São Paulo',
      state: 'SP',
      country: 'BR',
      provider: 'OPENSTREETMAP',
      onlyWithoutWebsite: true,
    });
  });

  it('shows country in search history labels', async () => {
    mocks.useSearches.mockReturnValue({
      data: {
        data: [{
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
        }],
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

    await user.click(screen.getByRole('checkbox', { name: 'Restaurante' }));
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
      onlyWithoutWebsite: true,
    });
  });

  it('shows a safe API error when search creation fails', async () => {
    const user = userEvent.setup();
    mocks.createSearch.mockRejectedValue(new Error('offline'));
    renderPage();

    await user.click(screen.getByRole('checkbox', { name: 'Restaurante' }));
    await user.selectOptions(screen.getByLabelText('Região'), 'SP');
    await user.selectOptions(screen.getByLabelText('Cidade'), 'São Paulo');
    await user.click(screen.getByRole('button', { name: 'Pesquisar empresas' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocorreu um erro inesperado.');
  });

  it('deletes a history item after confirmation and keeps leads note in the prompt', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.deleteSearch.mockResolvedValue(undefined);
    mocks.useSearches.mockReturnValue({
      data: {
        data: [{
          id: 'search-1',
          provider: 'OPENSTREETMAP',
          input: { categories: ['restaurant'], category: 'restaurant', city: 'São Paulo', state: 'SP', country: 'BR', onlyWithoutWebsite: true },
          status: 'FAILED',
          error: 'falhou',
          createdAt: '2026-07-22T10:00:00.000Z',
          completedAt: null,
        }],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Apagar pesquisa Restaurante / São Paulo' }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Leads já importados permanecem'));
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

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o histórico de pesquisas.');
    expect(screen.queryByText('Nenhuma pesquisa')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it('shows a retriable error instead of an empty result table when result loading fails', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mocks.useSearches.mockReturnValue({
      data: {
        data: [{
          id: 'search-1',
          provider: 'OPENSTREETMAP',
          input: { categories: ['restaurant'], category: 'restaurant', city: 'São Paulo', state: 'SP', country: 'BR', onlyWithoutWebsite: true },
          status: 'PROCESSING',
          createdAt: '2026-07-22T10:00:00.000Z',
          completedAt: null,
        }],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
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

  it('shows OpenStreetMap attribution and blocks imports until processing completes', async () => {
    const user = userEvent.setup();
    mocks.useSearches.mockReturnValue({
      data: {
        data: [{
          id: 'search-1',
          provider: 'OPENSTREETMAP',
          input: { categories: ['restaurant'], category: 'restaurant', city: 'São Paulo', state: 'SP', country: 'BR', onlyWithoutWebsite: true },
          status: 'PROCESSING',
          createdAt: '2026-07-22T10:00:00.000Z',
          completedAt: null,
        }],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.useSearchResults.mockReturnValue({
      data: {
        data: [{
          id: 'result-1',
          data: {
            externalId: 'node/1', companyName: 'Empresa em processamento', city: 'São Paulo', state: 'SP',
            country: 'BR', source: 'OPENSTREETMAP', websitePresence: 'NO_WEBSITE_REPORTED',
          },
          normalizedData: {
            externalId: 'node/1', companyName: 'Empresa em processamento', city: 'São Paulo', state: 'SP',
            country: 'BR', source: 'OPENSTREETMAP', websitePresence: 'NO_WEBSITE_REPORTED',
          },
          websitePresence: 'NO_WEBSITE_REPORTED',
          importedLeadId: null,
          createdAt: '2026-07-22T10:00:00.000Z',
        }],
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
    expect(screen.getByRole('checkbox', { name: 'Selecionar Empresa em processamento' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Importar selecionados (0)' })).toBeDisabled();
  });
});

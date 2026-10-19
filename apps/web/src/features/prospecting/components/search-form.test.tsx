import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { SearchForm } from './search-form';

const geo = vi.hoisted(() => ({
  regions: [{ code: 'SP', name: 'São Paulo' }],
  cities: [{ name: 'São Paulo' }],
  citiesLoading: false,
  citiesError: false,
}));
beforeEach(() => {
  geo.regions = [{ code: 'SP', name: 'São Paulo' }];
  geo.cities = [{ name: 'São Paulo' }];
  geo.citiesLoading = false;
  geo.citiesError = false;
});

vi.mock('@/features/billing/hooks', () => ({ useBillingStatus: () => ({ data: undefined }) }));
vi.mock('@/features/prospecting/hooks', () => ({
  useCreateSearch: () => ({ mutateAsync: vi.fn() }),
  useProspectingCategories: () => ({ data: undefined }),
  useGeoRegions: () => ({ data: geo.regions, isLoading: false }),
  useGeoCities: () => ({
    data: geo.citiesLoading || geo.citiesError ? undefined : geo.cities,
    isLoading: geo.citiesLoading,
    isError: geo.citiesError,
    error: geo.citiesError ? new Error('City lookup failed') : undefined,
  }),
}));

describe('Prospecting from client map', () => {
  it('keeps URL defaults selected when geographic options arrive asynchronously', () => {
    geo.regions = [];
    geo.cities = [];
    geo.citiesLoading = true;
    const renderForm = () => (
      <SearchForm
        actionError={null}
        onBeforeSubmit={vi.fn()}
        onCreated={vi.fn()}
        onError={vi.fn()}
      />
    );
    const view = renderWithProviders(renderForm(), {
      initialEntries: ['/prospectar?city=S%C3%A3o+Paulo&state=SP&country=BR'],
    });
    geo.regions = [{ code: 'SP', name: 'São Paulo' }];
    geo.cities = [{ name: 'São Paulo' }];
    geo.citiesLoading = false;
    view.rerender(
      <SearchForm
        actionError={null}
        onBeforeSubmit={vi.fn()}
        onCreated={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Região')).toHaveValue('SP');
    expect(screen.getByLabelText('Cidade')).toHaveValue('São Paulo');
  });
  it('prefills the selected client region and clears dependent values after a country change', () => {
    renderWithProviders(
      <SearchForm
        actionError={null}
        onBeforeSubmit={vi.fn()}
        onCreated={vi.fn()}
        onError={vi.fn()}
      />,
      {
        initialEntries: ['/prospectar?city=S%C3%A3o+Paulo&state=SP&country=BR'],
      },
    );
    expect(screen.getByLabelText('País')).toHaveValue('BR');
    expect(screen.getByLabelText('Região')).toHaveValue('SP');
    expect(screen.getByLabelText('Cidade')).toHaveValue('São Paulo');
    fireEvent.change(screen.getByLabelText('País'), { target: { value: 'PT' } });
    expect(screen.getByLabelText('Região')).toHaveValue('');
    expect(screen.getByLabelText('Cidade')).toHaveValue('');
  });

  it('keeps a city supplied by the active map filter when its region is selected', () => {
    geo.regions = [
      { code: 'SP', name: 'São Paulo' },
      { code: 'RJ', name: 'Rio de Janeiro' },
    ];
    geo.cities = [];
    geo.citiesLoading = true;
    const renderForm = () => (
      <SearchForm
        actionError={null}
        onBeforeSubmit={vi.fn()}
        onCreated={vi.fn()}
        onError={vi.fn()}
      />
    );
    const view = renderWithProviders(renderForm(), {
      initialEntries: ['/prospectar?city=S%C3%A3o+Paulo'],
    });
    fireEvent.change(screen.getByLabelText('Região'), { target: { value: 'SP' } });
    expect(screen.getByRole('button', { name: 'Pesquisar empresas' })).toBeDisabled();
    geo.cities = [{ name: 'São Paulo' }];
    geo.citiesLoading = false;
    view.rerender(renderForm());
    expect(screen.getByLabelText('Cidade')).toHaveValue('São Paulo');
    fireEvent.change(screen.getByLabelText('Região'), { target: { value: 'RJ' } });
    expect(screen.getByLabelText('Cidade')).toHaveValue('');
  });

  it.each([false, true])(
    'rejects an unvalidated initial city when cached options mismatch or fail (error=%s)',
    async (citiesError) => {
      geo.citiesError = citiesError;
      geo.regions = [{ code: 'RJ', name: 'Rio de Janeiro' }];
      geo.cities = [{ name: 'Rio de Janeiro' }];
      const onBeforeSubmit = vi.fn();
      renderWithProviders(
        <SearchForm
          actionError={null}
          onBeforeSubmit={onBeforeSubmit}
          onCreated={vi.fn()}
          onError={vi.fn()}
        />,
        { initialEntries: ['/prospectar?city=S%C3%A3o+Paulo'] },
      );
      fireEvent.change(screen.getByLabelText('Região'), { target: { value: 'RJ' } });
      const niche = screen.getByLabelText('Nicho') as HTMLSelectElement;
      fireEvent.change(niche, { target: { value: niche.options[1].value } });
      fireEvent.click(screen.getByRole('button', { name: 'Pesquisar empresas' }));
      expect(await screen.findByText('Selecione uma cidade')).toBeInTheDocument();
      expect(onBeforeSubmit).not.toHaveBeenCalled();
    },
  );

  it('does not hydrate foreign region and city values when country falls back to Brazil', () => {
    renderWithProviders(
      <SearchForm
        actionError={null}
        onBeforeSubmit={vi.fn()}
        onCreated={vi.fn()}
        onError={vi.fn()}
      />,
      { initialEntries: ['/prospectar?city=Lisboa&state=Lisboa&country=PT'] },
    );
    expect(screen.getByLabelText('País')).toHaveValue('BR');
    expect(screen.getByLabelText('Região')).toHaveValue('');
    expect(screen.getByLabelText('Cidade')).toHaveValue('');
  });
});

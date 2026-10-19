import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { SearchForm } from './search-form';

vi.mock('@/features/billing/hooks', () => ({ useBillingStatus: () => ({ data: undefined }) }));
vi.mock('@/features/prospecting/hooks', () => ({
  useCreateSearch: () => ({ mutateAsync: vi.fn() }),
  useProspectingCategories: () => ({ data: undefined }),
  useGeoRegions: () => ({ data: [{ code: 'SP', name: 'São Paulo' }], isLoading: false }),
  useGeoCities: () => ({ data: [{ name: 'São Paulo' }], isLoading: false }),
}));

describe('Prospecting from client map', () => {
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
});

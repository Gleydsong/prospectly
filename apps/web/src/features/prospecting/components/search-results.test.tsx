import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import userEvent from '@testing-library/user-event';
import '@/i18n';
import { downloadCsvFile } from '@/features/leads/api';
import { SearchResults } from './search-results';
import type { ProspectingSearchResult } from '@/types';

vi.mock('@/features/leads/api', () => ({ downloadCsvFile: vi.fn() }));

function resultAt(index: number): ProspectingSearchResult {
  const business = {
    externalId: `ext-${index}`,
    companyName: `Resultado ${index}`,
    city: 'São Paulo',
    state: 'SP',
    country: 'BR' as const,
    source: 'OPENSTREETMAP' as const,
    websitePresence: 'UNKNOWN' as const,
  };
  return {
    id: `result-${index}`,
    data: business,
    normalizedData: business,
    websitePresence: 'UNKNOWN',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('SearchResults grid', () => {
  it('renders the current result page as accessible cards', () => {
    const results = Array.from({ length: 40 }, (_, index) => resultAt(index));
    render(
      <SearchResults
        currentSearch={{
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
          status: 'COMPLETED',
          createdAt: '2026-01-01T00:00:00.000Z',
        }}
        results={results}
        resultsMeta={{ page: 1, pageSize: 40, total: 40, totalPages: 1 }}
        isLoading={false}
        isError={false}
        error={null}
        onRetry={() => undefined}
        importSummary={null}
        selectedResultIds={[]}
        selectableResultIds={results.map((item) => item.id)}
        allCurrentResultsSelected={false}
        withoutWebsiteCount={40}
        canImport
        importingResultId={null}
        importPending={false}
        onToggleResult={() => undefined}
        onToggleCurrentPage={() => undefined}
        onPageChange={() => undefined}
        onImportSelected={() => undefined}
        onImportOne={() => undefined}
      />,
    );

    expect(screen.getByText('Resultado 0')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(40);
    expect(screen.getByText('Resultado 39')).toBeInTheDocument();
  });

  it('keeps pagination mounted while the next page is loading', () => {
    const results = [resultAt(0)];
    const { rerender } = render(
      <SearchResults
        currentSearch={{
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
          status: 'COMPLETED',
          createdAt: '2026-01-01T00:00:00.000Z',
        }}
        results={results}
        resultsMeta={{ page: 1, pageSize: 20, total: 2, totalPages: 2 }}
        isLoading={false}
        isError={false}
        error={null}
        onRetry={() => undefined}
        importSummary={null}
        selectedResultIds={['result-0']}
        selectableResultIds={['result-0']}
        allCurrentResultsSelected
        withoutWebsiteCount={1}
        canImport
        importingResultId={null}
        importPending={false}
        onToggleResult={() => undefined}
        onToggleCurrentPage={() => undefined}
        onPageChange={() => undefined}
        onImportSelected={() => undefined}
        onImportOne={() => undefined}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Paginação' })).toBeInTheDocument();

    rerender(
      <SearchResults
        currentSearch={{
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
          status: 'COMPLETED',
          createdAt: '2026-01-01T00:00:00.000Z',
        }}
        results={[]}
        resultsMeta={undefined}
        isLoading
        isError={false}
        error={null}
        onRetry={() => undefined}
        importSummary={null}
        selectedResultIds={['result-0']}
        selectableResultIds={[]}
        allCurrentResultsSelected={false}
        withoutWebsiteCount={0}
        canImport
        importingResultId={null}
        importPending={false}
        onToggleResult={() => undefined}
        onToggleCurrentPage={() => undefined}
        onPageChange={() => undefined}
        onImportSelected={() => undefined}
        onImportOne={() => undefined}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Paginação' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar selecionados (1)' })).toBeEnabled();
  });
});

it('keeps every result action secondary and dispatches one add-all action', async () => {
  const onImportAll = vi.fn();
  const onImportSelected = vi.fn();
  const onImportOne = vi.fn();
  const result = resultAt(1);
  const { container } = render(
    <SearchResults
      currentSearch={{
        id: 'search',
        provider: 'OPENSTREETMAP',
        input: {
          categories: ['restaurant'],
          city: 'São Paulo',
          state: 'SP',
          country: 'BR',
          onlyWithoutWebsite: false,
        },
        status: 'COMPLETED',
        createdAt: '2026-10-20',
      }}
      results={[result]}
      resultsMeta={{ page: 1, pageSize: 20, total: 21, totalPages: 2 }}
      isLoading={false}
      isError={false}
      error={null}
      onRetry={vi.fn()}
      importSummary={null}
      selectedResultIds={[result.id]}
      selectableResultIds={[result.id]}
      allCurrentResultsSelected
      withoutWebsiteCount={1}
      canImport
      importingResultId={null}
      importPending={false}
      onToggleResult={vi.fn()}
      onToggleCurrentPage={vi.fn()}
      onPageChange={vi.fn()}
      onImportSelected={onImportSelected}
      onImportOne={onImportOne}
      onImportAll={onImportAll}
    />,
  );
  expect(container.querySelectorAll('.cta-primary')).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar todos' }));
  expect(onImportAll).toHaveBeenCalledTimes(1);
  expect(onImportOne).not.toHaveBeenCalled();
  expect(onImportSelected).not.toHaveBeenCalled();
});

it('exports selected results from earlier pages as well as the current page', async () => {
  const first = resultAt(1);
  const second = resultAt(2);
  render(
    <SearchResults
      currentSearch={undefined}
      results={[second]}
      isLoading={false}
      isError={false}
      error={null}
      onRetry={vi.fn()}
      importSummary={null}
      selectedResultIds={[first.id, second.id]}
      selectedResults={[first, second]}
      selectableResultIds={[second.id]}
      allCurrentResultsSelected
      withoutWebsiteCount={1}
      canImport
      importingResultId={null}
      importPending={false}
      onToggleResult={vi.fn()}
      onToggleCurrentPage={vi.fn()}
      onPageChange={vi.fn()}
      onImportSelected={vi.fn()}
      onImportOne={vi.fn()}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
  expect(downloadCsvFile).toHaveBeenCalledWith(
    expect.any(String),
    expect.stringContaining('Resultado 1'),
  );
  expect(downloadCsvFile).toHaveBeenCalledWith(
    expect.any(String),
    expect.stringContaining('Resultado 2'),
  );
});

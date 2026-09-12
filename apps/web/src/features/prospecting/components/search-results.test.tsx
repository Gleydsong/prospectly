import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import '@/i18n';
import { SearchResults } from './search-results';
import type { ProspectingSearchResult } from '@/types';

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

describe('SearchResults virtualization', () => {
  it('does not mount every result row at once', () => {
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
    expect(screen.getAllByText(/Resultado \d+/).length).toBeLessThan(40);
    expect(screen.queryByText('Resultado 39')).not.toBeInTheDocument();
  });
});

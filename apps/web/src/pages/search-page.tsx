import { useEffect, useMemo, useState } from 'react';

import { SearchForm } from '@/features/prospecting/components/search-form';
import { SearchHistory } from '@/features/prospecting/components/search-history';
import { SearchResults } from '@/features/prospecting/components/search-results';
import { fetchAllSearchResultIds } from '@/features/prospecting/api';
import {
  useDeleteSearch,
  useImportSearchResults,
  useSearch,
  useSearches,
  useSearchResults,
} from '@/features/prospecting/hooks';
import { getApiErrorMessage } from '@/lib/api';
import type { ProspectingSearchResult, SearchImportSummary } from '@/types';

export function SearchPage() {
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedSearchId, setSelectedSearchId] = useState('');
  const [resultsPage, setResultsPage] = useState(1);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [selectedResults, setSelectedResults] = useState<ProspectingSearchResult[]>([]);
  const [importingResultId, setImportingResultId] = useState<string | null>(null);
  const [importAllPending, setImportAllPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<SearchImportSummary | null>(null);

  const searchesQuery = useSearches({ page: historyPage, pageSize: 10 });
  const searchQuery = useSearch(selectedSearchId);
  const { refetch: refetchResults, ...resultsQuery } = useSearchResults(selectedSearchId, {
    page: resultsPage,
    pageSize: 20,
  });
  const deleteSearch = useDeleteSearch();
  const importResults = useImportSearchResults();

  const searches = searchesQuery.data?.data ?? [];
  const resultPage = resultsQuery.data;
  const results = useMemo(() => resultPage?.data ?? [], [resultPage]);
  const currentSearch =
    searchQuery.data ?? searches.find((search) => search.id === selectedSearchId);
  const canImport = currentSearch?.status === 'COMPLETED';
  const selectableResultIds = canImport
    ? results.filter((result) => !result.importedLeadId).map((result) => result.id)
    : [];
  const allCurrentResultsSelected =
    selectableResultIds.length > 0 &&
    selectableResultIds.every((id) => selectedResultIds.includes(id));
  const withoutWebsiteCount = results.filter(
    (result) => result.websitePresence !== 'WEBSITE_FOUND',
  ).length;

  useEffect(() => {
    if (currentSearch?.status === 'COMPLETED') {
      void refetchResults();
    }
  }, [currentSearch?.status, refetchResults]);

  const selectSearch = (id: string) => {
    if (id === selectedSearchId || importResults.isPending || importAllPending) return;
    setSelectedSearchId(id);
    setResultsPage(1);
    setSelectedResultIds([]);
    setSelectedResults([]);
    setImportSummary(null);
  };

  const toggleResult = (id: string) => {
    const result = results.find((entry) => entry.id === id);
    if (selectedResultIds.includes(id)) {
      setSelectedResultIds((current) => current.filter((resultId) => resultId !== id));
      setSelectedResults((current) => current.filter((entry) => entry.id !== id));
      return;
    }
    setSelectedResultIds((current) => [...current, id]);
    if (result) {
      setSelectedResults((current) => [...current.filter((entry) => entry.id !== id), result]);
    }
  };

  const toggleCurrentPage = () => {
    if (allCurrentResultsSelected) {
      const currentPage = new Set(selectableResultIds);
      setSelectedResultIds((current) => current.filter((id) => !currentPage.has(id)));
      setSelectedResults((current) => current.filter((entry) => !currentPage.has(entry.id)));
      return;
    }
    setSelectedResultIds((current) => [...new Set([...current, ...selectableResultIds])]);
    setSelectedResults((current) => [
      ...current.filter((entry) => !selectableResultIds.includes(entry.id)),
      ...results.filter((entry) => selectableResultIds.includes(entry.id)),
    ]);
  };

  const changeResultsPage = (page: number) => {
    setResultsPage(page);
  };

  const runImport = async (resultIds: string[], singleResultId?: string) => {
    if (!selectedSearchId || resultIds.length === 0) return;
    setServerError(null);
    setImportingResultId(singleResultId ?? null);
    try {
      const summary = await importResults.mutateAsync({
        searchId: selectedSearchId,
        resultIds,
      });
      setImportSummary(summary);
      setSelectedResultIds((current) => current.filter((id) => !resultIds.includes(id)));
      setSelectedResults((current) => current.filter((result) => !resultIds.includes(result.id)));
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setImportingResultId(null);
    }
  };

  const importAllResults = async () => {
    if (!selectedSearchId || !canImport || importAllPending || importResults.isPending) return;
    setServerError(null);
    setImportAllPending(true);
    try {
      const resultIds = await fetchAllSearchResultIds(selectedSearchId);
      await runImport(resultIds);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setImportAllPending(false);
    }
  };

  const removeSearch = async (searchId: string) => {
    if (importResults.isPending || importAllPending) return;
    const confirmed = window.confirm(
      'Apagar esta pesquisa do histórico? Os resultados serão removidos. Clientes já importados permanecem.',
    );
    if (!confirmed) return;
    setServerError(null);
    try {
      await deleteSearch.mutateAsync(searchId);
      if (selectedSearchId === searchId) {
        setSelectedSearchId('');
        setSelectedResultIds([]);
        setSelectedResults([]);
        setImportSummary(null);
      }
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-5">
      <SearchForm
        actionError={serverError}
        onBeforeSubmit={() => {
          setServerError(null);
          setImportSummary(null);
        }}
        onCreated={selectSearch}
        onError={setServerError}
      />

      {selectedSearchId ? (
        <SearchResults
          currentSearch={currentSearch}
          results={results}
          resultsMeta={resultPage?.meta}
          isLoading={resultsQuery.isLoading}
          isError={resultsQuery.isError}
          error={resultsQuery.error}
          onRetry={() => {
            void refetchResults();
          }}
          importSummary={importSummary}
          selectedResultIds={selectedResultIds}
          selectedResults={selectedResults}
          selectableResultIds={selectableResultIds}
          allCurrentResultsSelected={allCurrentResultsSelected}
          withoutWebsiteCount={withoutWebsiteCount}
          canImport={canImport}
          importingResultId={importingResultId}
          importPending={importResults.isPending || importAllPending}
          onToggleResult={toggleResult}
          onToggleCurrentPage={toggleCurrentPage}
          onPageChange={changeResultsPage}
          onImportSelected={() => void runImport(selectedResultIds)}
          onImportOne={(resultId) => void runImport([resultId], resultId)}
          onImportAll={() => void importAllResults()}
        />
      ) : null}

      <SearchHistory
        searches={searches}
        isLoading={searchesQuery.isLoading}
        isError={searchesQuery.isError}
        error={searchesQuery.error}
        onRetry={() => {
          void searchesQuery.refetch();
        }}
        meta={searchesQuery.data?.meta}
        onPageChange={setHistoryPage}
        selectedSearchId={selectedSearchId}
        onSelect={selectSearch}
        onDelete={(searchId) => {
          void removeSearch(searchId);
        }}
        deletingSearchId={deleteSearch.isPending ? deleteSearch.variables : undefined}
      />
    </div>
  );
}

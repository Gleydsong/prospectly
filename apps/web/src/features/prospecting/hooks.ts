import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createSearch,
  deleteSearch,
  fetchSearch,
  fetchSearchProviders,
  fetchSearches,
  fetchSearchResults,
  importSearchResults,
  type SearchResultsQuery,
  type SearchesQuery,
} from './api';
import type { SearchInput } from '@/types';

const POLLING_INTERVAL_MS = 2_000;

function isActiveSearch(status?: string): boolean {
  return status === 'PENDING' || status === 'PROCESSING';
}

export function useSearchProviders() {
  return useQuery({
    queryKey: ['searches', 'providers'],
    queryFn: fetchSearchProviders,
    staleTime: 60_000,
  });
}

export function useSearches(query: SearchesQuery = {}) {
  return useQuery({
    queryKey: ['searches', query],
    queryFn: () => fetchSearches(query),
    placeholderData: (previous) => previous,
    refetchInterval: (currentQuery) =>
      currentQuery.state.data?.data.some((search) => isActiveSearch(search.status))
        ? POLLING_INTERVAL_MS
        : false,
  });
}

export function useSearch(id: string) {
  return useQuery({
    queryKey: ['searches', id],
    queryFn: () => fetchSearch(id),
    enabled: Boolean(id),
    refetchInterval: (currentQuery) =>
      isActiveSearch(currentQuery.state.data?.status) ? POLLING_INTERVAL_MS : false,
  });
}

export function useSearchResults(id: string, query: SearchResultsQuery) {
  return useQuery({
    queryKey: ['searches', id, 'results', query],
    queryFn: () => fetchSearchResults(id, query),
    enabled: Boolean(id),
  });
}

export function useCreateSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SearchInput) => createSearch(input),
    onSuccess: (search) => {
      queryClient.setQueryData(['searches', search.id], search);
      void queryClient.invalidateQueries({ queryKey: ['searches'] });
    },
  });
}

export function useImportSearchResults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ searchId, resultIds }: { searchId: string; resultIds: string[] }) =>
      importSearchResults(searchId, resultIds),
    onSuccess: (_summary, { searchId }) => {
      void queryClient.invalidateQueries({ queryKey: ['searches', searchId, 'results'] });
      void queryClient.invalidateQueries({ queryKey: ['searches', searchId] });
    },
  });
}

export function useDeleteSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (searchId: string) => deleteSearch(searchId),
    onSuccess: (_void, searchId) => {
      queryClient.removeQueries({ queryKey: ['searches', searchId] });
      queryClient.removeQueries({ queryKey: ['searches', searchId, 'results'] });
      void queryClient.invalidateQueries({ queryKey: ['searches'] });
    },
  });
}

import { api } from '@/lib/api';
import type {
  PaginatedResult,
  ProspectingSearch,
  ProspectingSearchResult,
  SearchImportSummary,
  SearchInput,
  SearchProviderInfo,
  SearchStatus,
} from '@/types';

export interface SearchesQuery {
  page?: number;
  pageSize?: number;
  status?: SearchStatus;
}

export interface SearchResultsQuery {
  page?: number;
  pageSize?: number;
}

export async function fetchSearchProviders(): Promise<SearchProviderInfo[]> {
  const { data } = await api.get<SearchProviderInfo[]>('/searches/providers');
  return data;
}

export async function fetchSearches(query: SearchesQuery = {}): Promise<PaginatedResult<ProspectingSearch>> {
  const { data } = await api.get<PaginatedResult<ProspectingSearch>>('/searches', { params: query });
  return data;
}

export async function fetchSearch(id: string): Promise<ProspectingSearch> {
  const { data } = await api.get<ProspectingSearch>(`/searches/${id}`);
  return data;
}

export async function fetchSearchResults(
  id: string,
  query: SearchResultsQuery = {},
): Promise<PaginatedResult<ProspectingSearchResult>> {
  const { data } = await api.get<PaginatedResult<ProspectingSearchResult>>(`/searches/${id}/results`, {
    params: query,
  });
  return data;
}

export async function createSearch(input: SearchInput): Promise<ProspectingSearch> {
  const { data } = await api.post<ProspectingSearch>('/searches', input);
  return data;
}

export async function importSearchResults(id: string, resultIds: string[]): Promise<SearchImportSummary> {
  const { data } = await api.post<SearchImportSummary>(`/searches/${id}/import`, { resultIds });
  return data;
}

export async function deleteSearch(id: string): Promise<void> {
  await api.delete(`/searches/${id}`);
}

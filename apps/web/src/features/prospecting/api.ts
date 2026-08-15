import { api } from '@/lib/api';
import type {
  PaginatedResult,
  ProspectingCategoryCatalog,
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

export async function fetchProspectingCategories(): Promise<ProspectingCategoryCatalog> {
  const { data } = await api.get<ProspectingCategoryCatalog>('/searches/categories');
  return data;
}

export async function fetchSearches(
  query: SearchesQuery = {},
): Promise<PaginatedResult<ProspectingSearch>> {
  const { data } = await api.get<PaginatedResult<ProspectingSearch>>('/searches', {
    params: query,
  });
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
  const { data } = await api.get<PaginatedResult<ProspectingSearchResult>>(
    `/searches/${id}/results`,
    {
      params: query,
    },
  );
  return data;
}

export async function createSearch(input: SearchInput): Promise<ProspectingSearch> {
  const { data } = await api.post<ProspectingSearch>('/searches', input);
  return data;
}

export async function importSearchResults(
  id: string,
  resultIds: string[],
): Promise<SearchImportSummary> {
  const { data } = await api.post<SearchImportSummary>(`/searches/${id}/import`, { resultIds });
  return data;
}

export async function deleteSearch(id: string): Promise<void> {
  await api.delete(`/searches/${id}`);
}

export interface GeoRegionOption {
  code: string;
  name: string;
}

export interface GeoCityOption {
  name: string;
}

export async function fetchGeoRegions(country: string): Promise<GeoRegionOption[]> {
  const { data } = await api.get<GeoRegionOption[]>('/geo/regions', { params: { country } });
  return data;
}

export async function fetchGeoCities(country: string, region: string): Promise<GeoCityOption[]> {
  const { data } = await api.get<GeoCityOption[]>('/geo/cities', { params: { country, region } });
  return data;
}

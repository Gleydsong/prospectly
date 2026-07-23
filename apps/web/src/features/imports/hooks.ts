import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createCsvImport,
  fetchCsvImport,
  fetchCsvImportErrors,
  fetchImports,
  previewCsv,
  type ImportsQuery,
} from './api';
import type { CsvImportMapping } from '@/types';

const POLLING_INTERVAL_MS = 2_000;

function isActiveImport(status?: string): boolean {
  return status === 'PENDING' || status === 'PROCESSING';
}

export function useImports(query: ImportsQuery = {}) {
  return useQuery({
    queryKey: ['imports', query],
    queryFn: () => fetchImports(query),
    placeholderData: (previous) => previous,
    refetchInterval: (currentQuery) =>
      currentQuery.state.data?.data.some((csvImport) => isActiveImport(csvImport.status))
        ? POLLING_INTERVAL_MS
        : false,
  });
}

export function useImport(id: string) {
  return useQuery({
    queryKey: ['imports', id],
    queryFn: () => fetchCsvImport(id),
    enabled: Boolean(id),
    refetchInterval: (currentQuery) =>
      isActiveImport(currentQuery.state.data?.status) ? POLLING_INTERVAL_MS : false,
  });
}

export function useImportErrors(id: string, query: ImportsQuery = {}) {
  return useQuery({
    queryKey: ['imports', id, 'errors', query],
    queryFn: () => fetchCsvImportErrors(id, query),
    enabled: Boolean(id),
  });
}

export function usePreviewCsv() {
  return useMutation({ mutationFn: (file: File) => previewCsv(file) });
}

export function useCreateCsvImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, mapping }: { file: File; mapping: CsvImportMapping }) => createCsvImport(file, mapping),
    onSuccess: (csvImport) => {
      queryClient.setQueryData(['imports', csvImport.id], csvImport);
      void queryClient.invalidateQueries({ queryKey: ['imports'] });
    },
  });
}

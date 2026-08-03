import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createConversionPage,
  fetchEntitlements,
  fetchPageMetrics,
  getConversionPage,
  listConversionPages,
  publishConversionPage,
  restoreConversionPageVersion,
  updateConversionPageDraft,
} from './services/api';

export function useConversionPages(params?: { page?: number; leadId?: string }) {
  return useQuery({
    queryKey: ['conversion-pages', params],
    queryFn: () => listConversionPages(params),
  });
}

export function useConversionPage(id: string | undefined) {
  return useQuery({
    queryKey: ['conversion-pages', id],
    queryFn: () => getConversionPage(id!),
    enabled: Boolean(id),
  });
}

export function useEntitlements() {
  return useQuery({
    queryKey: ['conversion-pages', 'entitlements'],
    queryFn: fetchEntitlements,
  });
}

export function usePageMetrics(id: string | undefined) {
  return useQuery({
    queryKey: ['conversion-pages', id, 'metrics'],
    queryFn: () => fetchPageMetrics(id!),
    enabled: Boolean(id),
  });
}

export function useCreateConversionPage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createConversionPage,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['conversion-pages'] });
    },
  });
}

export function useUpdateConversionDraft(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { title?: string; blocks: unknown[]; expectedRevision?: number }) =>
      updateConversionPageDraft(id, input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['conversion-pages', id] });
      await client.invalidateQueries({ queryKey: ['conversion-pages'] });
    },
  });
}

export function usePublishConversionPage(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => publishConversionPage(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['conversion-pages', id] });
      await client.invalidateQueries({ queryKey: ['conversion-pages'] });
      await client.invalidateQueries({ queryKey: ['conversion-pages', 'entitlements'] });
    },
  });
}

export function useRestoreConversionVersion(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (version: number) => restoreConversionPageVersion(id, version),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['conversion-pages', id] });
    },
  });
}

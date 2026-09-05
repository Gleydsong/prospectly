import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  archiveSavedView,
  createSavedView,
  duplicateSavedView,
  fetchSavedView,
  fetchSavedViews,
  previewSavedView,
  updateSavedView,
  type CreateSavedViewInput,
  type UpdateSavedViewInput,
} from './api';

export function useSavedViews() {
  return useQuery({
    queryKey: ['saved-views'],
    queryFn: fetchSavedViews,
  });
}

export function useSavedView(id: string | undefined) {
  return useQuery({
    queryKey: ['saved-views', id],
    queryFn: () => fetchSavedView(id!),
    enabled: Boolean(id),
  });
}

export function useCreateSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSavedViewInput) => createSavedView(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-views'] });
    },
  });
}

export function useUpdateSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateSavedViewInput & { id: string }) =>
      updateSavedView(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-views'] });
    },
  });
}

export function useDuplicateSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => duplicateSavedView(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-views'] });
    },
  });
}

export function useArchiveSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveSavedView(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-views'] });
    },
  });
}

export function usePreviewSavedView(id: string | undefined) {
  return useQuery({
    queryKey: ['saved-views', id, 'preview'],
    queryFn: () => previewSavedView(id!),
    enabled: Boolean(id),
  });
}

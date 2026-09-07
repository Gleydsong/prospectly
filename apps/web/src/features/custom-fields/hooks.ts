import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  archiveCustomField,
  createCustomField,
  fetchCustomFields,
  reorderCustomFields,
  unarchiveCustomField,
  updateCustomField,
  type CustomFieldType,
} from './api';

export const CUSTOM_FIELDS_QUERY_KEY = ['custom-fields'] as const;

export function useCustomFields() {
  return useQuery({
    queryKey: CUSTOM_FIELDS_QUERY_KEY,
    queryFn: fetchCustomFields,
  });
}

export function useCreateCustomField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; type: CustomFieldType; options?: Array<{ label: string }> }) =>
      createCustomField(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CUSTOM_FIELDS_QUERY_KEY });
    },
  });
}

export function useUpdateCustomField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      options?: Array<{ id?: string; label: string; archived?: boolean }>;
    }) => updateCustomField(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CUSTOM_FIELDS_QUERY_KEY });
    },
  });
}

export function useArchiveCustomField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveCustomField,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CUSTOM_FIELDS_QUERY_KEY });
    },
  });
}

export function useUnarchiveCustomField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unarchiveCustomField,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CUSTOM_FIELDS_QUERY_KEY });
    },
  });
}

export function useReorderCustomFields() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reorderCustomFields,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CUSTOM_FIELDS_QUERY_KEY });
    },
  });
}

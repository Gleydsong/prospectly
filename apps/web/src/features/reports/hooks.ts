import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';

import {
  fetchFunnelConversion,
  fetchFunnelConversionLeads,
  type FunnelConversionFilters,
  type ReportBucket,
} from './api';
import {
  archiveSavedReport,
  createSavedReport,
  fetchSavedReports,
  type SavedReportDefinition,
} from './saved-reports-api';

export function useFunnelConversion(
  filters: FunnelConversionFilters,
  options?: { enabled?: boolean },
) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ['reports', 'funnel-conversion', userId, filters],
    queryFn: () => fetchFunnelConversion(filters),
    enabled: options?.enabled ?? true,
  });
}

export function useFunnelConversionLeads(
  filters: FunnelConversionFilters & { bucket: ReportBucket },
  options?: { enabled?: boolean },
) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ['reports', 'funnel-conversion', 'leads', userId, filters],
    queryFn: () => fetchFunnelConversionLeads(filters),
    enabled: options?.enabled ?? true,
  });
}

export function useSavedReports() {
  return useQuery({
    queryKey: ['saved-reports'],
    queryFn: fetchSavedReports,
  });
}

export function useCreateSavedReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; definition: SavedReportDefinition }) =>
      createSavedReport(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
    },
  });
}

export function useArchiveSavedReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveSavedReport,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
    },
  });
}

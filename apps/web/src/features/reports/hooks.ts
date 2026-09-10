import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';

import {
  fetchFunnelConversion,
  fetchFunnelConversionLeads,
  type FunnelConversionFilters,
  type ReportBucket,
} from './api';

export function useFunnelConversion(filters: FunnelConversionFilters) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ['reports', 'funnel-conversion', userId, filters],
    queryFn: () => fetchFunnelConversion(filters),
    retry: false,
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
    retry: false,
    enabled: options?.enabled ?? true,
  });
}

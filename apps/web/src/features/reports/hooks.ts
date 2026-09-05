import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';

import { fetchFunnelConversion, type FunnelConversionFilters } from './api';

export function useFunnelConversion(filters: FunnelConversionFilters) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ['reports', 'funnel-conversion', userId, filters],
    queryFn: () => fetchFunnelConversion(filters),
  });
}

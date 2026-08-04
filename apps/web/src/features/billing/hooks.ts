import { useQuery } from '@tanstack/react-query';

import { getBillingStatus } from './api';

export const BILLING_STATUS_QUERY_KEY = ['billing', 'status'] as const;

export function useBillingStatus() {
  return useQuery({
    queryKey: BILLING_STATUS_QUERY_KEY,
    queryFn: getBillingStatus,
    staleTime: 30_000,
  });
}

import { useQuery } from '@tanstack/react-query';

import { fetchSyncedCommunications } from './api';

export function useSyncedCommunications(leadId: string) {
  return useQuery({
    queryKey: ['leads', leadId, 'synced-communications'],
    queryFn: () => fetchSyncedCommunications(leadId),
    enabled: Boolean(leadId),
  });
}

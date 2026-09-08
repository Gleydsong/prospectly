import { api } from '@/lib/api';
import type { PaginatedResult } from '@/types';

export type SyncedCommunication = {
  id: string;
  channel: 'EMAIL' | 'CALENDAR';
  externalId: string;
  threadId: string | null;
  occurredAt: string;
  direction: 'IN' | 'OUT' | 'EVENT';
  from: string[];
  to: string[];
  cc: string[];
  subject: string;
  snippet: string;
  htmlLink: string;
};

export async function fetchSyncedCommunications(
  leadId: string,
): Promise<PaginatedResult<SyncedCommunication>> {
  const { data } = await api.get<PaginatedResult<SyncedCommunication>>(
    `/leads/${leadId}/synced-communications`,
    { params: { pageSize: 100 } },
  );
  return data;
}

export type SyncedThread = {
  threadId: string;
  latest: SyncedCommunication;
  messages: SyncedCommunication[];
};

export function groupEmailsByThread(items: SyncedCommunication[]): SyncedThread[] {
  const map = new Map<string, SyncedCommunication[]>();
  for (const item of items) {
    const key = item.threadId || item.externalId;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([threadId, messages]) => {
      const sorted = [...messages].sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      );
      return { threadId, latest: sorted[0]!, messages: sorted };
    })
    .sort(
      (a, b) => new Date(b.latest.occurredAt).getTime() - new Date(a.latest.occurredAt).getTime(),
    );
}

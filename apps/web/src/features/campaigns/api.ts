import { api } from '@/lib/api';
import type { PaginatedResult } from '@/types';

export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface CampaignListItem {
  id: string;
  name: string;
  description?: string | null;
  segment?: string | null;
  channel?: string | null;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
  template?: { id: string; name: string; category?: string } | null;
  owner?: { id: string; name: string } | null;
  _count?: { leads: number };
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  segment?: string;
  channel?: string;
}

export async function fetchCampaigns(params: {
  page?: number;
  pageSize?: number;
  status?: CampaignStatus;
} = {}): Promise<PaginatedResult<CampaignListItem>> {
  const { data } = await api.get<PaginatedResult<CampaignListItem>>('/campaigns', { params });
  return data;
}

export async function createCampaign(input: CreateCampaignInput): Promise<CampaignListItem> {
  const { data } = await api.post<CampaignListItem>('/campaigns', {
    ...input,
    channel: input.channel ?? 'ASSISTED',
  });
  return data;
}

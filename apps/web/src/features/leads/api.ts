import { api } from '@/lib/api';
import type {
  Activity,
  LeadDetail,
  LeadListItem,
  LeadStatus,
  PaginatedResult,
  Tag,
} from '@/types';

export interface LeadsQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: LeadStatus;
  city?: string;
  segment?: string;
  hasWebsite?: boolean;
  minScore?: number;
  maxScore?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function fetchLeads(query: LeadsQuery): Promise<PaginatedResult<LeadListItem>> {
  const { data } = await api.get<PaginatedResult<LeadListItem>>('/leads', { params: query });
  return data;
}

export async function fetchLead(id: string): Promise<LeadDetail> {
  const { data } = await api.get<LeadDetail>(`/leads/${id}`);
  return data;
}

export interface CreateLeadInput {
  companyName: string;
  tradeName?: string;
  category?: string;
  segment?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  city?: string;
  state?: string;
  country?: string;
  notes?: string;
  tags?: string[];
}

export async function createLead(input: CreateLeadInput): Promise<LeadDetail> {
  const { data } = await api.post<LeadDetail>('/leads', input);
  return data;
}

export async function updateLead(id: string, input: Partial<CreateLeadInput>): Promise<LeadDetail> {
  const { data } = await api.patch<LeadDetail>(`/leads/${id}`, input);
  return data;
}

export async function deleteLead(id: string): Promise<void> {
  await api.delete(`/leads/${id}`);
}

export async function fetchTags(): Promise<Tag[]> {
  const { data } = await api.get<Tag[]>('/leads/tags');
  return data;
}

export async function fetchLeadActivities(id: string): Promise<PaginatedResult<Activity>> {
  const { data } = await api.get<PaginatedResult<Activity>>(`/leads/${id}/activities`);
  return data;
}

export interface CreateActivityInput {
  type: string;
  description?: string;
  outcome?: string;
  nextAction?: string;
  followUpAt?: string;
}

export async function createActivity(leadId: string, input: CreateActivityInput): Promise<Activity> {
  const { data } = await api.post<Activity>(`/leads/${leadId}/activities`, input);
  return data;
}

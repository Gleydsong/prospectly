import { api } from '@/lib/api';
import type {
  Activity,
  LeadDetail,
  LeadExportResult,
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
  source?: string;
  category?: string;
  segment?: string;
  city?: string;
  ownerId?: string;
  tagId?: string;
  hasWebsite?: boolean;
  minScore?: number;
  maxScore?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: unknown;
  ids?: string[];
}

export async function fetchLeads(query: LeadsQuery): Promise<PaginatedResult<LeadListItem>> {
  const { filter, ids, ...rest } = query;
  const { data } = await api.get<PaginatedResult<LeadListItem>>('/leads', {
    params: {
      ...rest,
      ...(filter !== undefined ? { filter: JSON.stringify(filter) } : {}),
      ...(ids !== undefined ? { ids: ids.join(',') } : {}),
    },
  });
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

export async function createActivity(
  leadId: string,
  input: CreateActivityInput,
): Promise<Activity> {
  const { data } = await api.post<Activity>(`/leads/${leadId}/activities`, input);
  return data;
}

export const EXPORTABLE_LEAD_COLUMNS = [
  'id',
  'companyName',
  'tradeName',
  'category',
  'segment',
  'email',
  'phone',
  'whatsapp',
  'website',
  'domain',
  'city',
  'state',
  'country',
  'status',
  'source',
  'score',
  'rating',
  'reviewCount',
  'ownerId',
  'notes',
  'createdAt',
  'updatedAt',
  'lastContactAt',
  'nextContactAt',
] as const;

export type ExportableLeadColumn = (typeof EXPORTABLE_LEAD_COLUMNS)[number];

export const DEFAULT_EXPORT_COLUMNS: ExportableLeadColumn[] = [
  'companyName',
  'email',
  'phone',
  'website',
  'city',
  'status',
  'source',
  'score',
];

export async function exportLeadsCsv(input: {
  columns: ExportableLeadColumn[];
  q?: string;
  status?: LeadStatus;
  source?: string;
  category?: string;
  segment?: string;
  city?: string;
  ownerId?: string;
  tagId?: string;
  hasWebsite?: boolean;
  minScore?: number;
  maxScore?: number;
  filter?: unknown;
}): Promise<LeadExportResult> {
  const { data } = await api.post<LeadExportResult>('/leads/export', input);
  return data;
}

export function downloadCsvFile(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

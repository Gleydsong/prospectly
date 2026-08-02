import { api } from '@/lib/api';
import type { PaginatedResult } from '@/types';

export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED';

export type CampaignLeadResult =
  | 'CONTACTED'
  | 'REPLIED'
  | 'INTERESTED'
  | 'MEETING'
  | 'PROPOSAL'
  | 'WON'
  | 'LOST'
  | 'NO_RESPONSE'
  | 'OPT_OUT';

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

export interface CampaignStage {
  id: string;
  type: string;
  name: string;
  order: number;
  templateId?: string;
  metrics?: Record<string, number>;
}

export interface CampaignLeadRow {
  campaignId: string;
  leadId: string;
  status: string;
  currentStageId?: string | null;
  result?: CampaignLeadResult | null;
  lastContactedAt?: string | null;
  nextFollowUpAt?: string | null;
  nextAction?: string | null;
  addedAt: string;
  lead: {
    id: string;
    companyName: string;
    tradeName?: string | null;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
    status: string;
    score: number;
    doNotContact: boolean;
    website?: string | null;
  };
}

export interface CampaignDetail extends CampaignListItem {
  startsAt?: string | null;
  endsAt?: string | null;
  metrics?: { stages: CampaignStage[]; rules?: Record<string, unknown> };
  stageCounts?: Record<string, number>;
  leads?: CampaignLeadRow[];
  assistedOnly: boolean;
  autoSendEnabled: boolean;
  owner?: { id: string; name: string; email?: string } | null;
  _count?: { leads: number; tasks?: number; activities?: number };
}

export interface CampaignMetrics {
  campaignId: string;
  status: CampaignStatus;
  assistedOnly: boolean;
  autoSendEnabled: boolean;
  messageSent: boolean;
  eventsRecorded: number;
  instrumented: boolean;
  totals: {
    leads: number;
    pending: number;
    openTasks: number;
    contacted: number;
    replied: number;
    interested: number;
    meeting: number;
    proposal: number;
    won: number;
    lost: number;
    noResponse: number;
    optOut: number;
  };
  stages: Array<{
    id: string;
    type: string;
    name: string;
    order: number;
    templateId?: string;
    leadCount: number;
    openTasks: number;
  }>;
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  subject?: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplatePreviewResult {
  subject?: string;
  body: string;
  missing: string[];
  unknown: string[];
  allowedVariables: string[];
  autoSend: false;
  messageSent?: false;
  note: string;
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  segment?: string;
  channel?: string;
}

export interface CreateTemplateInput {
  name: string;
  category: string;
  subject?: string;
  body: string;
}

export async function fetchCampaigns(params: {
  page?: number;
  pageSize?: number;
  status?: CampaignStatus;
} = {}): Promise<PaginatedResult<CampaignListItem>> {
  const { data } = await api.get<PaginatedResult<CampaignListItem>>('/campaigns', { params });
  return data;
}

export async function fetchCampaign(id: string): Promise<CampaignDetail> {
  const { data } = await api.get<CampaignDetail>(`/campaigns/${id}`);
  return data;
}

export async function fetchCampaignMetrics(id: string): Promise<CampaignMetrics> {
  const { data } = await api.get<CampaignMetrics>(`/campaigns/${id}/metrics`);
  return data;
}

export async function createCampaign(input: CreateCampaignInput): Promise<CampaignListItem> {
  const { data } = await api.post<CampaignListItem>('/campaigns', {
    ...input,
    channel: input.channel ?? 'ASSISTED',
  });
  return data;
}

export async function updateCampaignStatus(
  id: string,
  status: CampaignStatus,
): Promise<CampaignListItem> {
  const { data } = await api.patch<CampaignListItem>(`/campaigns/${id}/status`, { status });
  return data;
}

export async function addCampaignLeads(id: string, leadIds: string[]): Promise<CampaignDetail> {
  const { data } = await api.post<CampaignDetail>(`/campaigns/${id}/leads`, { leadIds });
  return data;
}

export async function removeCampaignLead(id: string, leadId: string): Promise<{ removed: boolean }> {
  const { data } = await api.delete<{ removed: boolean }>(`/campaigns/${id}/leads/${leadId}`);
  return data;
}

export async function fetchCampaignLeads(
  id: string,
  params: { page?: number; pageSize?: number; status?: string; stageId?: string } = {},
): Promise<PaginatedResult<CampaignLeadRow>> {
  const { data } = await api.get<PaginatedResult<CampaignLeadRow>>(`/campaigns/${id}/leads`, {
    params,
  });
  return data;
}

export async function createStageTasks(
  campaignId: string,
  stageId: string,
  body: { leadIds?: string[]; dueAt?: string } = {},
): Promise<{ tasksCreated: number; tasksSkipped: number; autoSend: false }> {
  const { data } = await api.post<{
    tasksCreated: number;
    tasksSkipped: number;
    autoSend: false;
  }>(`/campaigns/${campaignId}/stages/${stageId}/tasks`, body);
  return data;
}

export async function recordCampaignLeadResult(
  campaignId: string,
  leadId: string,
  body: {
    result: CampaignLeadResult;
    note?: string;
    nextAction?: string;
    followUpAt?: string;
    stageId?: string;
  },
): Promise<{ messageSent: false; autoSendEnabled: false }> {
  const { data } = await api.post<{ messageSent: false; autoSendEnabled: false }>(
    `/campaigns/${campaignId}/leads/${leadId}/result`,
    body,
  );
  return data;
}

export async function fetchMessageTemplates(params: {
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedResult<MessageTemplate>> {
  const { data } = await api.get<PaginatedResult<MessageTemplate>>('/message-templates', {
    params,
  });
  return data;
}

export async function fetchTemplateVariables(): Promise<string[]> {
  const { data } = await api.get<{ variables: string[] }>('/message-templates/variables');
  return data.variables;
}

export async function createMessageTemplate(input: CreateTemplateInput): Promise<MessageTemplate> {
  const { data } = await api.post<MessageTemplate>('/message-templates', input);
  return data;
}

export async function updateMessageTemplate(
  id: string,
  input: Partial<CreateTemplateInput>,
): Promise<MessageTemplate> {
  const { data } = await api.patch<MessageTemplate>(`/message-templates/${id}`, input);
  return data;
}

export async function previewMessageTemplate(input: {
  subject?: string;
  body: string;
  values?: Record<string, string>;
}): Promise<TemplatePreviewResult> {
  const { data } = await api.post<TemplatePreviewResult>('/message-templates/preview', input);
  return data;
}

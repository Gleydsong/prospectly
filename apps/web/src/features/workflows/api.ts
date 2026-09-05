import { api } from '@/lib/api';

export type WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type WorkflowFilterMode = 'all' | 'noWebsite';

export interface WorkflowAddTagStep {
  type: 'add_tag';
  tagName: string;
}

export interface WorkflowDefinition {
  trigger: { type: 'lead.created' };
  filter?: { field: string; op: string; value?: string | number | boolean };
  steps: WorkflowAddTagStep[];
}

export interface WorkflowPublishedVersion {
  id: string;
  version: number;
  definition: WorkflowDefinition;
  publishedAt: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  draftDefinition: WorkflowDefinition;
  publishedVersion: WorkflowPublishedVersion | null;
  archivedAt: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  executesToday: boolean;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  definition: WorkflowDefinition;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string | null;
  definition?: WorkflowDefinition;
}

export function buildWorkflowDraftDefinition(input: {
  tagName: string;
  filterMode: WorkflowFilterMode;
}): WorkflowDefinition {
  const tagName = input.tagName.trim();
  const definition: WorkflowDefinition = {
    trigger: { type: 'lead.created' },
    steps: tagName ? [{ type: 'add_tag', tagName }] : [],
  };
  if (input.filterMode === 'noWebsite') {
    definition.filter = { field: 'hasWebsite', op: 'eq', value: false };
  }
  return definition;
}

export function tagNameFromDefinition(definition: WorkflowDefinition | null | undefined): string {
  const step = definition?.steps?.find((item) => item.type === 'add_tag');
  return step?.tagName ?? '';
}

export function filterModeFromDefinition(
  definition: WorkflowDefinition | null | undefined,
): WorkflowFilterMode {
  const filter = definition?.filter;
  if (filter?.field === 'hasWebsite' && filter.op === 'eq' && filter.value === false) {
    return 'noWebsite';
  }
  return 'all';
}

export async function fetchWorkflows(): Promise<Workflow[]> {
  const { data } = await api.get<Workflow[]>('/workflows');
  return data;
}

export async function createWorkflow(input: CreateWorkflowInput): Promise<Workflow> {
  const { data } = await api.post<Workflow>('/workflows', input);
  return data;
}

export async function updateWorkflow(id: string, input: UpdateWorkflowInput): Promise<Workflow> {
  const { data } = await api.patch<Workflow>(`/workflows/${id}`, input);
  return data;
}

export async function publishWorkflow(id: string): Promise<Workflow> {
  const { data } = await api.post<Workflow>(`/workflows/${id}/publish`);
  return data;
}

export async function pauseWorkflow(id: string): Promise<Workflow> {
  const { data } = await api.post<Workflow>(`/workflows/${id}/pause`);
  return data;
}

export async function resumeWorkflow(id: string): Promise<Workflow> {
  const { data } = await api.post<Workflow>(`/workflows/${id}/resume`);
  return data;
}

export async function archiveWorkflow(id: string): Promise<Workflow> {
  const { data } = await api.post<Workflow>(`/workflows/${id}/archive`);
  return data;
}

import { api } from '@/lib/api';
import type { LeadStatus, PaginatedResult } from '@/types';

export type SavedViewVisibility = 'PRIVATE' | 'TEAM';

export interface LeadViewDefinition {
  q?: string;
  status?: LeadStatus;
  source?: string;
  category?: string;
  segment?: string;
  city?: string;
  ownerId?: string;
  tagId?: string;
  minScore?: number;
  maxScore?: number;
  hasWebsite?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SavedView {
  id: string;
  name: string;
  description: string | null;
  visibility: SavedViewVisibility;
  resourceType: 'LEAD';
  definition: LeadViewDefinition;
  archivedAt: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
}

export interface CreateSavedViewInput {
  name: string;
  description?: string;
  visibility?: SavedViewVisibility;
  definition: LeadViewDefinition;
}

export async function fetchSavedViews(): Promise<SavedView[]> {
  const { data } = await api.get<SavedView[]>('/views');
  return data;
}

export async function fetchSavedView(id: string): Promise<SavedView> {
  const { data } = await api.get<SavedView>(`/views/${id}`);
  return data;
}

export async function createSavedView(input: CreateSavedViewInput): Promise<SavedView> {
  const { data } = await api.post<SavedView>('/views', input);
  return data;
}

export async function archiveSavedView(id: string): Promise<SavedView> {
  const { data } = await api.post<SavedView>(`/views/${id}/archive`);
  return data;
}

export async function previewSavedView(id: string): Promise<{ total: number }> {
  const { data } = await api.get<{ total: number }>(`/views/${id}/preview`);
  return data;
}

export type { PaginatedResult };

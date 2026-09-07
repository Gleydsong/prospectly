import { api } from '@/lib/api';

export type CustomFieldType = 'text' | 'number' | 'select' | 'date';

export interface CustomFieldOption {
  id: string;
  label: string;
  archivedAt: string | null;
}

export interface CustomFieldDefinition {
  id: string;
  name: string;
  type: CustomFieldType;
  position: number;
  archivedAt: string | null;
  options: CustomFieldOption[];
}

export async function fetchCustomFields(): Promise<CustomFieldDefinition[]> {
  const { data } = await api.get<CustomFieldDefinition[]>('/custom-fields');
  return data;
}

export async function createCustomField(input: {
  name: string;
  type: CustomFieldType;
  options?: Array<{ label: string }>;
}): Promise<CustomFieldDefinition> {
  const { data } = await api.post<CustomFieldDefinition>('/custom-fields', input);
  return data;
}

export async function updateCustomField(
  id: string,
  input: {
    name?: string;
    options?: Array<{ id?: string; label: string; archived?: boolean }>;
  },
): Promise<CustomFieldDefinition> {
  const { data } = await api.patch<CustomFieldDefinition>(`/custom-fields/${id}`, input);
  return data;
}

export async function archiveCustomField(id: string): Promise<CustomFieldDefinition> {
  const { data } = await api.post<CustomFieldDefinition>(`/custom-fields/${id}/archive`);
  return data;
}

export async function unarchiveCustomField(id: string): Promise<CustomFieldDefinition> {
  const { data } = await api.post<CustomFieldDefinition>(`/custom-fields/${id}/unarchive`);
  return data;
}

export async function reorderCustomFields(ids: string[]): Promise<CustomFieldDefinition[]> {
  const { data } = await api.post<CustomFieldDefinition[]>('/custom-fields/reorder', { ids });
  return data;
}

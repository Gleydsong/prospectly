import { api } from '@/lib/api';

export const ORGANIZATION_FLAG_KEYS = ['saved_report'] as const;

export type OrganizationFlagKey = (typeof ORGANIZATION_FLAG_KEYS)[number];

export type OrganizationFlag = {
  key: OrganizationFlagKey;
  enabled: boolean;
};

export async function fetchOrganizationFlags(): Promise<OrganizationFlag[]> {
  const { data } = await api.get<OrganizationFlag[]>('/organization-flags');
  return data;
}

export async function updateOrganizationFlag(
  key: OrganizationFlagKey,
  enabled: boolean,
): Promise<OrganizationFlag> {
  const { data } = await api.put<OrganizationFlag>(`/organization-flags/${key}`, { enabled });
  return data;
}

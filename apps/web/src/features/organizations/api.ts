import { api } from '@/lib/api';
import type { Role } from '@/types';

export interface OrganizationCurrent {
  id: string;
  name: string;
  slug: string;
  plan: string;
  planStatus: string;
  planCurrency: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { members: number; leads: number };
}

export interface OrgMember {
  id: string;
  role: Role;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

export type InviteRole = Role.ADMIN | Role.SALES | Role.MEMBER | Role.VIEWER;

export async function fetchCurrentOrganization(): Promise<OrganizationCurrent> {
  const { data } = await api.get<OrganizationCurrent>('/organizations/current');
  return data;
}

export async function updateOrganizationName(name: string): Promise<{ id: string; name: string }> {
  const { data } = await api.patch<{ id: string; name: string }>('/organizations/current', {
    name,
  });
  return data;
}

export async function fetchOrganizationMembers(): Promise<OrgMember[]> {
  const { data } = await api.get<OrgMember[]>('/organizations/members');
  return data;
}

export async function inviteOrganizationMember(input: {
  name: string;
  email: string;
  role: InviteRole;
  temporaryPassword: string;
}): Promise<OrgMember> {
  const { data } = await api.post<OrgMember>('/organizations/members', input);
  return data;
}

export async function updateOrganizationMemberRole(
  memberId: string,
  role: Role,
): Promise<{ id: string; role: Role }> {
  const { data } = await api.patch<{ id: string; role: Role }>(
    `/organizations/members/${memberId}`,
    { role },
  );
  return data;
}

export async function removeOrganizationMember(memberId: string): Promise<void> {
  await api.delete(`/organizations/members/${memberId}`);
}

import { api } from '@/lib/api';

export type OauthMembership = {
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  organization: { id: string; name: string };
};

export type OauthConsentInput = {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  resource: string;
  scope?: string;
  state?: string;
  organizationId?: string;
  decision: 'allow' | 'deny';
};

export async function fetchAuthorizableOrgs(): Promise<
  Array<{ id: string; name: string; role: OauthMembership['role'] }>
> {
  const { data } = await api.get<{ memberships?: OauthMembership[] }>('/users/me');
  return (data.memberships ?? [])
    .filter((item) => item.role === 'OWNER' || item.role === 'ADMIN')
    .map((item) => ({ id: item.organization.id, name: item.organization.name, role: item.role }));
}

export async function submitOauthConsent(input: OauthConsentInput): Promise<{ redirect: string }> {
  const { data } = await api.post<{ redirect: string }>('/oauth/consent', input);
  return data;
}

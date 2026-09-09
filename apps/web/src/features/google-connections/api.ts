import { api } from '@/lib/api';

export type GoogleConnectionView = {
  connected: boolean;
  googleEmail: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
};

export type OrgGoogleConnectionView = {
  userId: string;
  googleEmail: string;
  connectedAt: string;
};

export async function fetchMyGoogleConnection(): Promise<GoogleConnectionView> {
  const { data } = await api.get<GoogleConnectionView>('/google-connections/me');
  return data;
}

export async function fetchOrgGoogleConnections(): Promise<OrgGoogleConnectionView[]> {
  const { data } = await api.get<OrgGoogleConnectionView[]>('/google-connections');
  return data;
}

export async function startGoogleConnection(): Promise<{ url: string }> {
  const { data } = await api.get<{ url: string }>('/google-connections/start');
  return data;
}

export async function disconnectGoogleConnection(): Promise<GoogleConnectionView> {
  const { data } = await api.post<GoogleConnectionView>('/google-connections/disconnect');
  return data;
}

export async function revokeGoogleConnection(userId: string): Promise<void> {
  await api.post(`/google-connections/${userId}/revoke`);
}

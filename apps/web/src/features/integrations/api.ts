import { api } from '@/lib/api';

export type PluginToken = {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export async function fetchPluginTokens(): Promise<PluginToken[]> {
  const { data } = await api.get<PluginToken[]>('/integrations/plugins/tokens');
  return data;
}

export async function createPluginToken(name: string): Promise<PluginToken & { token: string }> {
  const { data } = await api.post<PluginToken & { token: string }>('/integrations/plugins/tokens', { name });
  return data;
}

export async function revokePluginToken(id: string): Promise<void> {
  await api.delete(`/integrations/plugins/tokens/${encodeURIComponent(id)}`);
}

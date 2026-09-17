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

export type McpConnection = {
  id: string;
  clientName: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function mcpPublicUrl(
  apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1',
): string {
  if (!/^https?:\/\//i.test(apiBaseUrl)) {
    return 'http://127.0.0.1:3000/mcp';
  }
  const url = new URL(apiBaseUrl);
  return `${url.protocol}//${url.host}/mcp`;
}

export async function fetchMcpConnections(): Promise<McpConnection[]> {
  const { data } = await api.get<McpConnection[]>('/integrations/mcp/connections');
  return data;
}

export async function revokeMcpConnection(id: string): Promise<void> {
  await api.delete(`/integrations/mcp/connections/${encodeURIComponent(id)}`);
}

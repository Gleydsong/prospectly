import { api } from '@/lib/api';
import type { IntegrationWebhook, WebhookDelivery } from '@/types';

export async function fetchIntegrations(): Promise<IntegrationWebhook[]> {
  const { data } = await api.get<IntegrationWebhook[]>('/integrations');
  return data;
}

export async function upsertWebhookIntegration(input: {
  url: string;
  enabled?: boolean;
  label?: string;
}): Promise<IntegrationWebhook> {
  const { data } = await api.post<IntegrationWebhook>('/integrations/webhook', input);
  return data;
}

export async function rotateWebhookSecret(): Promise<IntegrationWebhook> {
  const { data } = await api.post<IntegrationWebhook>('/integrations/webhook/rotate-secret');
  return data;
}

export async function fetchWebhookDeliveries(): Promise<WebhookDelivery[]> {
  const { data } = await api.get<WebhookDelivery[]>('/integrations/webhook/deliveries');
  return data;
}

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

import { api } from '@/lib/api';
import type { IntegrationWebhook } from '@/types';

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

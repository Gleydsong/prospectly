import { api } from '@/lib/api';

export interface ScoreRule {
  id: string;
  key: string;
  description: string | null;
  points: number;
  enabled: boolean;
}

export interface ScoreConfiguration {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  rules: ScoreRule[];
}

export async function fetchScoreConfig(): Promise<ScoreConfiguration> {
  const { data } = await api.get<ScoreConfiguration>('/scoring/config');
  return data;
}

export async function updateScoreRules(
  rules: Array<{ key: string; enabled?: boolean; points?: number }>,
): Promise<ScoreConfiguration> {
  const { data } = await api.patch<ScoreConfiguration>('/scoring/config/rules', { rules });
  return data;
}

export async function requestLeadWebsiteAnalysis(leadId: string): Promise<{
  queued: boolean;
  analysisId?: string;
  status?: string;
  reason?: string;
}> {
  const { data } = await api.post(`/leads/${leadId}/analyze`);
  return data;
}

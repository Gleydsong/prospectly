import { api } from '@/lib/api';
import type { PipelineBoard, PipelineStageLeadsPage } from '@/types';

export async function fetchPipelineBoard(params?: {
  pipelineId?: string;
  limit?: number;
  offset?: number;
}): Promise<PipelineBoard> {
  const { data } = await api.get<PipelineBoard>('/pipelines/board', { params });
  return data;
}

export async function fetchStageLeads(
  stageId: string,
  params?: { limit?: number; offset?: number },
): Promise<PipelineStageLeadsPage> {
  const { data } = await api.get<PipelineStageLeadsPage>(`/pipelines/stages/${stageId}/leads`, {
    params,
  });
  return data;
}

export async function moveLeadToStage(leadId: string, stageId: string): Promise<void> {
  await api.patch(`/leads/${leadId}/stage`, { stageId });
}

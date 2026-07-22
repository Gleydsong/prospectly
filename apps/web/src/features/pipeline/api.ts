import { api } from '@/lib/api';
import type { PipelineBoard } from '@/types';

export async function fetchPipelineBoard(): Promise<PipelineBoard> {
  const { data } = await api.get<PipelineBoard>('/pipelines/board');
  return data;
}

export async function moveLeadToStage(leadId: string, stageId: string): Promise<void> {
  await api.patch(`/leads/${leadId}/stage`, { stageId });
}

import type { LeadStage, PipelineListItem } from '@/types';

export function selectInitialPipelineStage(
  pipelines: PipelineListItem[] | undefined,
): LeadStage | null {
  const pipeline = pipelines?.find((item) => item.isDefault) ?? pipelines?.[0];
  if (!pipeline) return null;

  return [...pipeline.stages].sort((left, right) => left.order - right.order)[0] ?? null;
}

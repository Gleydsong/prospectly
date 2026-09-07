import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { LeadStage, PipelineListItem } from '@/types';

export function orderedPipelineStages(
  pipelines: PipelineListItem[] | undefined,
): Array<LeadStage & { order: number }> {
  const pipeline = pipelines?.find((item) => item.isDefault) ?? pipelines?.[0];
  if (!pipeline) return [];
  return [...pipeline.stages].sort((left, right) => left.order - right.order);
}

export function LeadPipelineStepper({
  stages,
  currentStageId,
  pending,
  onSelect,
}: {
  stages: Array<LeadStage & { order: number }>;
  currentStageId?: string | null;
  pending?: boolean;
  onSelect: (stage: LeadStage) => void;
}) {
  if (stages.length === 0) return null;

  const currentIndex = stages.findIndex((stage) => stage.id === currentStageId);

  return (
    <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Etapas do funil">
      {stages.map((stage, index) => {
        const isCurrent = stage.id === currentStageId;
        const isDone = currentIndex >= 0 && index < currentIndex;
        return (
          <li key={stage.id} className="min-w-0 shrink-0">
            <button
              type="button"
              disabled={pending || isCurrent}
              onClick={() => onSelect(stage)}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'inline-flex max-w-[11rem] items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]',
                'disabled:cursor-default',
                isCurrent &&
                  'border-transparent bg-[color:var(--status-info-bg)] text-[color:var(--status-info-ink)]',
                isDone &&
                  !isCurrent &&
                  'border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--ink)] hover:bg-[color:var(--surface-hover)]',
                !isCurrent &&
                  !isDone &&
                  'border-[color:var(--border)] text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--ink)]',
                pending && 'opacity-60',
              )}
            >
              {isDone ? <Check className="h-3 w-3 shrink-0" aria-hidden /> : null}
              <span className="truncate">{stage.name}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

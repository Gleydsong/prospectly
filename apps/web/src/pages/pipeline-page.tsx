import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchPipelineBoard, moveLeadToStage } from '@/features/pipeline/api';
import { cn } from '@/lib/utils';

export function PipelinePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const board = useQuery({ queryKey: ['pipeline', 'board'], queryFn: fetchPipelineBoard });
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);

  const move = useMutation({
    mutationFn: ({ leadId, stageId }: { leadId: string; stageId: string }) =>
      moveLeadToStage(leadId, stageId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  if (board.isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-96 w-72 shrink-0" />
        ))}
      </div>
    );
  }

  if (board.isError || !board.data) {
    return (
      <p className="rounded-lg bg-red-500/10 p-4 text-sm text-red-300" role="alert">
        Erro ao carregar pipeline.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{t('leads.pipeline')}</h1>
        <p className="text-sm text-zinc-500">{board.data.pipeline.name} — arraste leads entre etapas</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4" role="list" aria-label="Etapas do pipeline">
        {board.data.stages.map((stage) => (
          <section
            key={stage.id}
            role="listitem"
            aria-label={stage.name}
            onDragOver={(event) => {
              event.preventDefault();
              setOverStageId(stage.id);
            }}
            onDragLeave={() => setOverStageId((current) => (current === stage.id ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              if (draggingLeadId) {
                move.mutate({ leadId: draggingLeadId, stageId: stage.id });
              }
              setDraggingLeadId(null);
              setOverStageId(null);
            }}
            className={cn(
              'flex w-72 shrink-0 flex-col rounded-control border border-zinc-800 bg-zinc-900/60',
              overStageId === stage.id ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-zinc-800',
            )}
          >
            <header
              className="flex items-center justify-between rounded-t-xl px-3 py-2.5"
              style={{ borderTop: `3px solid ${stage.color ?? '#94a3b8'}` }}
            >
              <h2 className="text-sm font-semibold text-zinc-100">{stage.name}</h2>
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-zinc-500">
                {stage.leads.length}
              </span>
            </header>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {stage.leads.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-700 p-3 text-center text-xs text-zinc-400">
                  Arraste leads para cá
                </p>
              ) : (
                stage.leads.map((lead) => (
                  <Card
                    key={lead.id}
                    draggable
                    onDragStart={() => setDraggingLeadId(lead.id)}
                    onDragEnd={() => {
                      setDraggingLeadId(null);
                      setOverStageId(null);
                    }}
                    className={cn(
                      'cursor-grab p-3 hover:shadow-md',
                      draggingLeadId === lead.id && 'opacity-50',
                    )}
                  >
                    <Link
                      to={`/leads/${lead.id}`}
                      className="block text-sm font-medium text-zinc-50 hover:text-brand-400"
                    >
                      {lead.companyName}
                    </Link>
                    <p className="mt-0.5 text-xs text-zinc-500">{lead.city ?? '—'}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <ScoreBadge score={lead.score} />
                      <span className="text-xs text-zinc-400">{lead.owner?.name ?? ''}</span>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

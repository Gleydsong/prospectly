import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchPipelineBoard, fetchStageLeads, moveLeadToStage } from '@/features/pipeline/api';
import { cn } from '@/lib/utils';
import type { LeadListItem, PipelineBoardStage } from '@/types';

const PAGE_SIZE = 50;

export function PipelinePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const liveRegionId = useId();
  const board = useQuery({
    queryKey: ['pipeline', 'board'],
    queryFn: () => fetchPipelineBoard({ limit: PAGE_SIZE, offset: 0 }),
  });
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [loadingMoreStageId, setLoadingMoreStageId] = useState<string | null>(null);
  const moveSelectRefs = useRef<Record<string, HTMLSelectElement | null>>({});

  const move = useMutation({
    mutationFn: ({ leadId, stageId }: { leadId: string; stageId: string; leadName: string; stageName: string }) =>
      moveLeadToStage(leadId, stageId),
    onSuccess: (_data, variables) => {
      setAnnouncement(
        t('pipeline.movedAnnouncement', {
          lead: variables.leadName,
          stage: variables.stageName,
        }),
      );
      requestAnimationFrame(() => {
        moveSelectRefs.current[variables.leadId]?.focus();
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const appendStageLeads = async (stage: PipelineBoardStage) => {
    if (!board.data || !stage.hasMore) return;
    setLoadingMoreStageId(stage.id);
    try {
      const page = await fetchStageLeads(stage.id, {
        limit: PAGE_SIZE,
        offset: stage.leads.length,
      });
      queryClient.setQueryData<typeof board.data>(['pipeline', 'board'], (current) => {
        if (!current) return current;
        return {
          ...current,
          stages: current.stages.map((item) =>
            item.id === stage.id
              ? {
                  ...item,
                  leads: [...item.leads, ...page.leads],
                  totalCount: page.totalCount,
                  hasMore: page.hasMore,
                }
              : item,
          ),
        };
      });
    } finally {
      setLoadingMoreStageId(null);
    }
  };

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
        {t('pipeline.loadError')}
      </p>
    );
  }

  const stages = board.data.stages;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{t('leads.pipeline')}</h1>
        <p className="text-sm text-zinc-500">{t('pipeline.subtitle', { name: board.data.pipeline.name })}</p>
      </div>

      <div
        id={liveRegionId}
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>

      <div
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-4 pb-4"
        role="list"
        aria-label={t('pipeline.stagesLabel')}
      >
        {stages.map((stage) => (
          <section
            key={stage.id}
            role="listitem"
            aria-label={`${stage.name}, ${t('pipeline.columnCount', { shown: stage.leads.length, total: stage.totalCount })}`}
            onDragOver={(event) => {
              event.preventDefault();
              setOverStageId(stage.id);
            }}
            onDragLeave={() => setOverStageId((current) => (current === stage.id ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              if (draggingLeadId) {
                const lead = stages.flatMap((item) => item.leads).find((item) => item.id === draggingLeadId);
                move.mutate({
                  leadId: draggingLeadId,
                  stageId: stage.id,
                  leadName: lead?.companyName ?? draggingLeadId,
                  stageName: stage.name,
                });
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
                {stage.totalCount}
              </span>
            </header>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {stage.leads.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-700 p-3 text-center text-xs text-zinc-400">
                  {t('pipeline.emptyColumn')}
                </p>
              ) : (
                stage.leads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    stages={stages}
                    currentStageId={stage.id}
                    dragging={draggingLeadId === lead.id}
                    disabled={move.isPending}
                    selectRef={(node) => {
                      moveSelectRefs.current[lead.id] = node;
                    }}
                    onDragStart={() => setDraggingLeadId(lead.id)}
                    onDragEnd={() => {
                      setDraggingLeadId(null);
                      setOverStageId(null);
                    }}
                    onMove={(stageId, stageName) => {
                      move.mutate({
                        leadId: lead.id,
                        stageId,
                        leadName: lead.companyName,
                        stageName,
                      });
                    }}
                  />
                ))
              )}
              {stage.hasMore ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 w-full"
                  loading={loadingMoreStageId === stage.id}
                  onClick={() => {
                    void appendStageLeads(stage);
                  }}
                >
                  {t('pipeline.loadMore', {
                    remaining: Math.max(stage.totalCount - stage.leads.length, 0),
                  })}
                </Button>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  stages,
  currentStageId,
  dragging,
  disabled,
  selectRef,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  lead: LeadListItem;
  stages: PipelineBoardStage[];
  currentStageId: string;
  dragging: boolean;
  disabled: boolean;
  selectRef: (node: HTMLSelectElement | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (stageId: string, stageName: string) => void;
}) {
  const { t } = useTranslation();
  const otherStages = stages.filter((stage) => stage.id !== currentStageId);

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn('cursor-grab space-y-2 p-3 hover:shadow-md', dragging && 'opacity-50')}
    >
      <Link
        to={`/leads/${lead.id}`}
        className="block text-sm font-medium text-zinc-50 hover:text-brand-400"
      >
        {lead.companyName}
      </Link>
      <p className="text-xs text-zinc-500">{lead.city ?? '—'}</p>
      <div className="flex items-center justify-between">
        <ScoreBadge score={lead.score} />
        <span className="text-xs text-zinc-400">{lead.owner?.name ?? ''}</span>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-400">{t('pipeline.moveToStage')}</span>
        <select
          ref={selectRef}
          className="h-8 w-full rounded-control border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
          defaultValue=""
          disabled={disabled || otherStages.length === 0}
          aria-label={t('pipeline.moveToStageFor', { lead: lead.companyName })}
          onChange={(event) => {
            const stageId = event.target.value;
            if (!stageId) return;
            const stage = stages.find((item) => item.id === stageId);
            if (!stage) return;
            onMove(stageId, stage.name);
            event.target.value = '';
          }}
        >
          <option value="">{t('pipeline.chooseStage')}</option>
          {otherStages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </label>
    </Card>
  );
}

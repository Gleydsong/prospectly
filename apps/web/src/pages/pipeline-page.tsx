import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import {
  WhatsAppOutreachModal,
  type WhatsAppOutreachModalLead,
} from '@/features/agents/components';
import { fetchPipelineBoard, fetchStageLeads, moveLeadToStage } from '@/features/pipeline/api';
import { kanbanToneClass, kanbanToneFromStage } from '@/lib/kanban-tone';
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
  const [whatsAppModalLead, setWhatsAppModalLead] = useState<WhatsAppOutreachModalLead | null>(null);
  const moveSelectRefs = useRef<Record<string, HTMLSelectElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollBoard = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const distance = 320;
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

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
      <p className="rounded-control bg-[color:var(--status-danger-bg)] p-4 text-sm text-[color:var(--status-danger-ink)]" role="alert">
        {t('pipeline.loadError')}
      </p>
    );
  }

  const stages = board.data.stages;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--ink)]">{t('leads.pipeline')}</h1>
          <p className="text-sm text-[color:var(--ink-secondary)]">{t('pipeline.subtitle', { name: board.data.pipeline.name })}</p>
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Navegação horizontal do funil">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => scrollBoard('left')}
            aria-label="Rolar colunas para a esquerda"
            title="Rolar colunas para a esquerda"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => scrollBoard('right')}
            aria-label="Rolar colunas para a direita"
            title="Rolar colunas para a direita"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
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
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-4 pb-4"
        role="list"
        aria-label={t('pipeline.stagesLabel')}
      >
        {stages.map((stage, index) => (
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
              'kanban-col',
              kanbanToneClass(kanbanToneFromStage(stage.name, index)),
              overStageId === stage.id && 'ring-2 ring-[color:var(--ring)]',
            )}
          >
            <header className="kanban-col__header">
              <h2 className="mr-2 truncate text-sm font-semibold" title={stage.name}>
                {stage.name}
              </h2>
              <span
                className="shrink-0 rounded-full bg-black/10 px-2.5 py-0.5 text-xs font-semibold"
                title={`${stage.totalCount} leads nesta etapa`}
              >
                {stage.totalCount}
              </span>
            </header>
            <div className="flex min-h-0 flex-1 flex-col p-2">
              {stage.leads.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[color:var(--border)] p-3 text-center text-xs text-[color:var(--ink-secondary)]">
                  {t('pipeline.emptyColumn')}
                </p>
              ) : (
                <VirtualizedList
                  count={stage.leads.length}
                  estimateSize={176}
                  className="kanban-col__body"
                  ariaLabel={stage.name}
                  getItemKey={(index) => stage.leads[index]?.id ?? index}
                >
                  {(index) => {
                    const lead = stage.leads[index];
                    if (!lead) return null;
                    return (
                      <div className="pb-2">
                        <LeadCard
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
                          onOpenWhatsApp={(leadItem) =>
                            setWhatsAppModalLead({
                              id: leadItem.id,
                              companyName: leadItem.companyName,
                              phone: leadItem.phone,
                              stageId: stage.id,
                              doNotContact: leadItem.doNotContact,
                            })
                          }
                        />
                      </div>
                    );
                  }}
                </VirtualizedList>
              )}
              {stage.hasMore ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 w-full shrink-0"
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

      <WhatsAppOutreachModal
        lead={whatsAppModalLead}
        stages={stages.map((s) => ({ id: s.id, name: s.name }))}
        isOpen={Boolean(whatsAppModalLead)}
        onClose={() => setWhatsAppModalLead(null)}
      />
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
  onOpenWhatsApp,
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
  onOpenWhatsApp: (lead: LeadListItem) => void;
}) {
  const { t } = useTranslation();
  const otherStages = stages.filter((stage) => stage.id !== currentStageId);

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'cursor-grab space-y-2 rounded-card p-3 shadow-none hover:bg-[color:var(--surface-hover)]',
        dragging && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <Link
          to={`/leads/${lead.id}`}
          className="block text-sm font-medium text-[color:var(--ink)] hover:text-[color:var(--accent)] truncate flex-1"
        >
          {lead.companyName}
        </Link>
        {lead.phone && !lead.doNotContact ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenWhatsApp(lead);
            }}
            title={t('agents.whatsapp.open')}
            className="text-[color:var(--ink-muted)] hover:text-brand-400 p-0.5 rounded-control hover:bg-[color:var(--surface-hover)] shrink-0"
            data-testid={`kanban-whatsapp-${lead.id}`}
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      <p className="text-xs text-[color:var(--ink-secondary)]">{lead.city ?? '—'}</p>
      <div className="flex items-center justify-between">
        <ScoreBadge score={lead.score} />
        <span className="text-xs text-[color:var(--ink-secondary)]">{lead.owner?.name ?? ''}</span>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-[color:var(--ink-secondary)]">{t('pipeline.moveToStage')}</span>
        <select
          ref={selectRef}
          className="h-8 w-full rounded-control border border-[color:var(--border)] bg-[color:var(--surface-card)] px-2 text-xs text-[color:var(--ink)] focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
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

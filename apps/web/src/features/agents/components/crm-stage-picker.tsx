import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { fetchPipelines } from '@/features/pipeline/api';
import { cn } from '@/lib/utils';

export interface CrmStagePickerProps {
  currentStageId?: string;
  onSelect: (stageId: string) => void;
  pending?: boolean;
  className?: string;
}

export function CrmStagePicker({
  currentStageId,
  onSelect,
  pending,
  className,
}: CrmStagePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const pipelines = useQuery({
    queryKey: ['pipelines'],
    queryFn: fetchPipelines,
    enabled: open,
  });

  const stages = useMemo(
    () => (pipelines.data ?? []).flatMap((pipeline) => pipeline.stages ?? []),
    [pipelines.data],
  );

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function choose(stageId: string) {
    setOpen(false);
    onSelect(stageId);
  }

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      <Button
        size="sm"
        variant="secondary"
        loading={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {t('agents.crm.moveStage')}
        <ChevronDown
          className={cn('h-4 w-4 transition-transform duration-150', open && 'rotate-180')}
          aria-hidden
        />
      </Button>

      <div
        role="menu"
        aria-label={t('agents.crm.moveStage')}
        className={cn(
          'absolute left-0 top-full z-40 mt-2 w-56 origin-top rounded-control border border-[color:var(--border)] bg-[color:var(--surface-card)] p-1.5 shadow-[0_16px_32px_-18px_rgba(0,0,0,0.65)]',
          'transition duration-150 ease-out',
          open
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none -translate-y-1 scale-95 opacity-0',
        )}
      >
        {pipelines.isLoading ? (
          <p className="px-2.5 py-2 text-xs text-[color:var(--ink-muted)]">{t('common.loading')}</p>
        ) : stages.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-[color:var(--ink-muted)]">
            {t('agents.crm.noStages')}
          </p>
        ) : (
          <ul className="max-h-64 overflow-y-auto">
            {stages.map((stage) => {
              const isCurrent = stage.id === currentStageId;
              return (
                <li key={stage.id}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={isCurrent}
                    onClick={() => choose(stage.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-control px-2.5 py-2 text-left text-sm transition-colors',
                      isCurrent
                        ? 'cursor-default font-medium text-[color:var(--ink-muted)]'
                        : 'text-[color:var(--ink)] hover:bg-[color:var(--surface-subtle)]',
                    )}
                  >
                    <span className="truncate">{stage.name}</span>
                    {isCurrent ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

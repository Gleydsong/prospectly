import { cn } from '@/lib/utils';

export interface LeadScoreProps {
  score?: number | null;
  className?: string;
}

export function LeadScore({ score, className }: LeadScoreProps) {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return <span className="text-sm text-slate-400 dark:text-slate-500">—</span>;
  }

  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  let tempLabel = 'Frio';
  let badgeStyles =
    'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700';
  let progressFillStyles = 'bg-slate-400 dark:bg-slate-500';

  if (clampedScore >= 80) {
    tempLabel = 'Alto';
    badgeStyles =
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
    progressFillStyles = 'bg-emerald-500';
  } else if (clampedScore >= 50) {
    tempLabel = 'Médio';
    badgeStyles =
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
    progressFillStyles = 'bg-amber-500';
  }

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span className="text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {clampedScore}/100
      </span>
      <div
        className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={clampedScore}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Lead score ${clampedScore} de 100`}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', progressFillStyles)}
          style={{ width: `${clampedScore}%` }}
        />
      </div>
      <span
        className={cn(
          'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide',
          badgeStyles,
        )}
      >
        {tempLabel}
      </span>
    </div>
  );
}

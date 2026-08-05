import type { ComponentType, ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  loading?: boolean;
  /** Destaca a métrica principal do bloco. */
  emphasis?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  emphasis,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'surface-bento animate-fade-rise rounded-panel border p-4 shadow-panel transition-colors',
        emphasis ? 'surface-bento-accent border-brand-500/25' : 'border-white/[0.08]',
        'hover:border-white/20',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">{label}</p>
        {Icon ? (
          <Icon
            className={cn('h-4 w-4', emphasis ? 'text-brand-300' : 'text-zinc-500')}
            aria-hidden
          />
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-zinc-50">
          {value}
        </p>
      )}
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

import type { ComponentType, ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { useCountUp } from '@/hooks/use-count-up';
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
  /** Quando definido, anima de 0 → valor (count-up). */
  animateValue?: number;
  /** Sufixo após o número animado (ex.: `%`). */
  animateSuffix?: string;
  /** Casas decimais do count-up. */
  animateDecimals?: number;
}

function AnimatedMetricValue({
  value,
  suffix = '',
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
}) {
  const display = useCountUp(value);
  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();
  return (
    <>
      {formatted}
      {suffix ? <span className="text-2xl text-zinc-400">{suffix}</span> : null}
    </>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  emphasis,
  className,
  animateValue,
  animateSuffix,
  animateDecimals = 0,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'surface-bento animate-fade-rise rounded-panel border p-4 shadow-panel transition-colors',
        emphasis ? 'surface-bento-accent border-brand-500/25' : 'border-white/[0.08]',
        'hover:border-white/20 hover:-translate-y-0.5',
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
          {typeof animateValue === 'number' ? (
            <AnimatedMetricValue
              value={animateValue}
              suffix={animateSuffix}
              decimals={animateDecimals}
            />
          ) : (
            value
          )}
        </p>
      )}
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

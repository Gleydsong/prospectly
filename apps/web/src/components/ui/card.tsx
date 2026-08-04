import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Surface = 'default' | 'elevated' | 'bento' | 'accent';

const surfaces: Record<Surface, string> = {
  default: 'rounded-panel border-white/10 bg-zinc-900 shadow-panel',
  elevated: 'rounded-panel border-white/[0.12] bg-zinc-800 shadow-elevated',
  bento: 'rounded-bento border-white/10 bg-zinc-900 bg-surface-sheen shadow-elevated',
  accent: 'rounded-bento border-brand-500/25 bg-zinc-900 bg-accent-sheen shadow-elevated',
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  surface?: Surface;
  /** Realce discreto no hover. Use apenas em cards clicáveis. */
  interactive?: boolean;
}

export function Card({ className, surface = 'default', interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'border transition-colors',
        surfaces[surface],
        interactive && 'hover:border-white/20 hover:bg-zinc-800/60',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-white/[0.08] p-5 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight text-zinc-50">{title}</h3>
        {description ? <p className="mt-0.5 text-sm text-zinc-400">{description}</p> : null}
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
    </div>
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

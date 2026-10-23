import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type CardSurface = 'default' | 'panel' | 'elevated' | 'bento' | 'accent';

const surfaces: Record<CardSurface, string> = {
  default: 'rounded-card border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] shadow-soft',
  panel: 'rounded-panel border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] shadow-soft',
  elevated: 'rounded-card border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] shadow-elevated',
  bento: 'rounded-card border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] shadow-soft',
  accent: 'rounded-card border border-[color:var(--border-default)] bg-[color:var(--brand-well)] shadow-soft',
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  surface?: CardSurface;
  /** Realce discreto no hover. Use apenas em cards clicáveis. */
  interactive?: boolean;
}

export function Card({ className, surface = 'default', interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'transition-[background-color,border-color,box-shadow] duration-200',
        surfaces[surface],
        interactive &&
          'cursor-pointer hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-hover)]',
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
        'flex flex-col gap-3 border-b border-[color:var(--border-default)] p-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--ink)]">
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-sm text-[color:var(--ink-secondary)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
    </div>
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />;
}

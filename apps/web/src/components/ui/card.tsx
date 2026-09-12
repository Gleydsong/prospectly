import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Surface = 'default' | 'elevated' | 'bento' | 'accent';

const surfaces: Record<Surface, string> = {
  default: 'rounded-card border-[color:var(--border-default)] bg-[color:var(--bg-surface)] shadow-panel',
  elevated: 'rounded-card border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] shadow-panel',
  bento: 'rounded-card border-[color:var(--border-default)] bg-[color:var(--bg-surface)] shadow-panel',
  accent: 'rounded-card border-[color:var(--border-default)] bg-[color:var(--brand-well)] shadow-panel',
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
        'border transition-[background-color,border-color,box-shadow] duration-200',
        surfaces[surface],
        interactive && 'cursor-pointer hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-hover)]',
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
        <h3 className="text-base font-semibold tracking-tight text-[color:var(--ink)]">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-sm text-[color:var(--ink-secondary)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
    </div>
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}

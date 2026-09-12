import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? (
          <p className="mb-1 text-xs font-medium text-[color:var(--ink-secondary)]">{eyebrow}</p>
        ) : null}
        <h1 className="text-balance text-2xl font-semibold leading-tight tracking-tight text-[color:var(--ink)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-[65ch] text-sm leading-relaxed text-[color:var(--ink-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

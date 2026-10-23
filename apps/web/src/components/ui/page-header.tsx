import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { MonoLabel } from './mono-label';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * PageHeader — Cabeçalho de página redesenhado com Inter Tight 800,
 * breadcrumb/rótulo mono opcional (Geist Mono 500, +12%) e ações alinhadas à direita.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  breadcrumb,
  actions,
  className,
}: PageHeaderProps) {
  const topLabel = breadcrumb ?? eyebrow;

  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4 pb-2', className)}>
      <div className="min-w-0 max-w-3xl">
        {topLabel ? (
          <div className="mb-1.5 flex items-center gap-2">
            {typeof topLabel === 'string' ? (
              <MonoLabel>{topLabel}</MonoLabel>
            ) : (
              <div className="font-mono text-xs font-medium uppercase tracking-mono-label text-[color:var(--ink-secondary)]">
                {topLabel}
              </div>
            )}
          </div>
        ) : null}
        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-display text-[color:var(--ink)] leading-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-[color:var(--ink-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div> : null}
    </div>
  );
}

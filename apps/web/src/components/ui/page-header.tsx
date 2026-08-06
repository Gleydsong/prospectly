import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Rótulo curto acima do título (etapa do fluxo, seção) — estilo Facilitey uppercase. */
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
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-balance text-[1.75rem] font-bold leading-tight tracking-tight text-[color:var(--ink)] sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-[color:var(--ink-muted)] sm:text-[15px]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

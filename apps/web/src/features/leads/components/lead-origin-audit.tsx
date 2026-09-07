import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function LeadOriginAudit({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-[color:var(--border)] pt-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium uppercase tracking-wide text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        Origem & Auditoria Técnica
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

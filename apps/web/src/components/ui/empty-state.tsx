import { Inbox } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-[color:var(--border)] bg-[color:var(--surface-card)] bg-noise px-6 py-14 text-center">
      <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
        <Icon className="h-5 w-5 text-[color:var(--ink-muted)]" />
      </span>
      <h3 className="text-base font-semibold text-[color:var(--ink)]">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-[color:var(--ink-muted)]">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

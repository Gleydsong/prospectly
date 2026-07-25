import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-control border border-dashed border-zinc-700 bg-zinc-900 px-6 py-14 text-center">
      <Inbox className="h-10 w-10 text-zinc-600" aria-hidden />
      <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-zinc-400">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

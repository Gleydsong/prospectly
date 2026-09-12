import { Link } from 'react-router-dom';

import { ScoreBadge } from '@/components/ui/score-badge';
import { kanbanToneClass, kanbanToneFromLeadStatus } from '@/lib/kanban-tone';
import { getLeadStatusLabel } from '@/lib/lead-status';
import { cn } from '@/lib/utils';
import { LeadStatus } from '@/types';
import type { LeadListItem } from '@/types';

const STATUS_COLUMNS = Object.values(LeadStatus);

export function LeadsKanban({
  leads,
  label,
}: {
  leads: LeadListItem[];
  label: string;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4" role="list" aria-label={label}>
      {STATUS_COLUMNS.map((status) => {
        const cards = leads.filter((lead) => lead.status === status);
        const tone = kanbanToneFromLeadStatus(status);
        return (
          <section
            key={status}
            role="listitem"
            className={cn('kanban-col', kanbanToneClass(tone))}
            aria-label={getLeadStatusLabel(status)}
          >
            <header className="kanban-col__header">
              <h2 className="truncate text-sm font-semibold">{getLeadStatusLabel(status)}</h2>
              <span className="shrink-0 rounded-full bg-black/10 px-2 py-0.5 text-xs font-semibold tabular-nums">
                {cards.length}
              </span>
            </header>
            <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto p-2">
              {cards.map((lead) => (
                <li key={lead.id}>
                  <Link
                    to={`/leads/${lead.id}`}
                    className="block rounded-card border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-3 hover:bg-[color:var(--surface-hover)]"
                  >
                    <p className="truncate font-medium text-[color:var(--ink)]">{lead.companyName}</p>
                    <p className="mt-1 text-xs text-[color:var(--ink-secondary)]">{lead.city ?? '—'}</p>
                    <div className="mt-2">
                      <ScoreBadge score={lead.score} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

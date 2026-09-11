import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { ScoreBadge } from '@/components/ui/score-badge';
import { getLeadStatusLabel } from '@/lib/lead-status';
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
    <div className="flex gap-4 overflow-x-auto pb-4" role="list" aria-label={label}>
      {STATUS_COLUMNS.map((status) => {
        const cards = leads.filter((lead) => lead.status === status);
        return (
          <section
            key={status}
            role="listitem"
            className="flex w-72 shrink-0 flex-col rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]"
            aria-label={getLeadStatusLabel(status)}
          >
            <header className="flex items-center justify-between gap-2 border-b border-[color:var(--border)] px-3 py-2">
              <h2 className="text-sm font-semibold text-[color:var(--ink)]">
                {getLeadStatusLabel(status)}
              </h2>
              <Badge>{cards.length}</Badge>
            </header>
            <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto p-2">
              {cards.map((lead) => (
                <li key={lead.id}>
                  <Link
                    to={`/leads/${lead.id}`}
                    className="block rounded-lg border border-[color:var(--border)] p-3 hover:bg-[color:var(--surface-hover)]"
                  >
                    <p className="truncate font-medium text-[color:var(--ink)]">{lead.companyName}</p>
                    <p className="mt-1 text-xs text-[color:var(--ink-muted)]">{lead.city ?? '—'}</p>
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

import { useTranslation } from 'react-i18next';

import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { ScoreBadge } from '@/components/ui/score-badge';
import { cn, formatDate } from '@/lib/utils';
import type { LeadListItem } from '@/types';

export interface LeadCardGridProps {
  leads: LeadListItem[];
  onSelect: (leadId: string) => void;
  className?: string;
  emptyLabel?: string;
}

export function LeadCardGrid({ leads, onSelect, className, emptyLabel }: LeadCardGridProps) {
  const { t } = useTranslation();
  if (leads.length === 0) {
    return (
      <div
        className={cn(
          'flex min-h-40 items-center justify-center rounded-card border border-dashed border-[color:var(--border)] p-6 text-center text-sm text-[color:var(--ink-muted)]',
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {leads.map((lead) => {
        const subtitle =
          [lead.city, lead.segment ?? lead.category].filter(Boolean).join(' · ') || '—';
        return (
          <button
            key={lead.id}
            type="button"
            aria-label={lead.companyName}
            onClick={() => onSelect(lead.id)}
            className={cn(
              'group flex flex-col rounded-card border border-[color:var(--border)] bg-[color:var(--surface-card)] p-3.5 text-left',
              'shadow-[0_1px_2px_rgba(0,0,0,0.35)] transition-all duration-200 ease-out',
              'hover:-translate-y-0.5 hover:border-[color:var(--border-strong)] hover:shadow-[0_16px_32px_-18px_rgba(0,0,0,0.65)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg-app)]',
            )}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[color:var(--ink)]">
                  {lead.companyName}
                </span>
                <span className="mt-0.5 block truncate text-xs text-[color:var(--ink-muted)]">
                  {subtitle}
                </span>
              </span>
              <ScoreBadge score={lead.score} />
            </span>
            <span className="mt-3 flex items-center justify-between gap-2">
              <LeadStatusBadge status={lead.status} />
              <span className="truncate text-[11px] text-[color:var(--ink-muted)]">
                {t('agents.sentToCrmOn', { date: formatDate(lead.createdAt) })}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

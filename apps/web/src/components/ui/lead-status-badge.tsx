import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getLeadStatusMeta } from '@/lib/lead-status';
import { cn } from '@/lib/utils';
import { LeadStatus } from '@/types';

const STATUS_STYLES: Record<LeadStatus, string> = {
  [LeadStatus.NEW]: 'bg-[color:var(--brand-soft)] text-[color:var(--brand-hover)]',
  [LeadStatus.CONTACTED]:
    'bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-ink)]',
  [LeadStatus.QUALIFIED]: 'bg-[color:var(--brand-soft)] text-[color:var(--brand-hover)]',
  [LeadStatus.MEETING_SCHEDULED]: 'bg-[color:var(--brand-soft)] text-[color:var(--brand-hover)]',
  [LeadStatus.PROPOSAL_SENT]: 'bg-[color:var(--brand-soft)] text-[color:var(--brand-hover)]',
  [LeadStatus.NEGOTIATION]:
    'bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-ink)]',
  [LeadStatus.WON]: 'bg-[color:var(--status-teal-bg)] text-[color:var(--status-teal-ink)]',
  [LeadStatus.LOST]: 'bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-ink)]',
  [LeadStatus.TO_REVIEW]: 'bg-[color:var(--brand-soft)] text-[color:var(--brand-hover)]',
  [LeadStatus.RESPONDED]:
    'bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-ink)]',
  [LeadStatus.DISQUALIFIED]:
    'bg-[color:var(--status-neutral-bg)] text-[color:var(--status-neutral-ink)]',
  [LeadStatus.ARCHIVED]:
    'bg-[color:var(--status-neutral-bg)] text-[color:var(--status-neutral-ink)]',
};

export interface LeadStatusBadgeProps {
  status: LeadStatus;
  className?: string;
}

export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  const { i18n } = useTranslation();
  const entry = getLeadStatusMeta(status);
  const styleClasses =
    STATUS_STYLES[status] ??
    'bg-[color:var(--status-neutral-bg)] text-[color:var(--status-neutral-ink)]';

  return (
    <span
      key={i18n.language}
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        styleClasses,
        className,
      )}
    >
      {status === LeadStatus.NEW ? (
        <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--brand)] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--brand)]" />
        </span>
      ) : null}

      {status === LeadStatus.WON ? (
        <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
      ) : null}

      <span>{entry.label}</span>
    </span>
  );
}

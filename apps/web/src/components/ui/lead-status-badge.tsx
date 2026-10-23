import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getLeadStatusMeta } from '@/lib/lead-status';
import { getLeadStatusStyle } from '@/lib/lead-status-colors';
import { cn } from '@/lib/utils';
import { LeadStatus } from '@/types';

export interface LeadStatusBadgeProps {
  status: LeadStatus;
  className?: string;
}

export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  const { i18n } = useTranslation();
  const entry = getLeadStatusMeta(status);

  return (
    <span
      key={i18n.language}
      data-status={status}
      style={getLeadStatusStyle(status)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        className,
      )}
    >
      {status === LeadStatus.NEW ? (
        <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--brand)] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--brand)]" />
        </span>
      ) : null}

      {status === LeadStatus.WON ? <Check className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}

      <span>{entry.label}</span>
    </span>
  );
}

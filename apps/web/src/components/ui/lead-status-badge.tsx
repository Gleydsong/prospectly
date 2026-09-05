import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getLeadStatusMeta } from '@/lib/lead-status';
import { cn } from '@/lib/utils';
import { LeadStatus } from '@/types';

const STATUS_STYLES: Record<LeadStatus, string> = {
  [LeadStatus.NEW]:
    'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60',
  [LeadStatus.CONTACTED]:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
  [LeadStatus.QUALIFIED]:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
  [LeadStatus.MEETING_SCHEDULED]:
    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60',
  [LeadStatus.PROPOSAL_SENT]:
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60',
  [LeadStatus.NEGOTIATION]:
    'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/60',
  [LeadStatus.WON]:
    'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
  [LeadStatus.LOST]:
    'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
  [LeadStatus.TO_REVIEW]:
    'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/60',
  [LeadStatus.RESPONDED]:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
  [LeadStatus.DISQUALIFIED]:
    'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700/60',
  [LeadStatus.ARCHIVED]:
    'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/60',
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
    'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700/60';

  return (
    <span
      key={i18n.language}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide',
        styleClasses,
        className,
      )}
    >
      {status === LeadStatus.NEW ? (
        <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500" />
        </span>
      ) : null}

      {status === LeadStatus.WON ? (
        <Check
          className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        />
      ) : null}

      <span>{entry.label}</span>
    </span>
  );
}

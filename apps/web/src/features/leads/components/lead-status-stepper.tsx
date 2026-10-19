import { useTranslation } from 'react-i18next';

import { getLeadStatusStyle } from '@/lib/lead-status-colors';
import { getLeadStatusMeta } from '@/lib/lead-status';
import { LeadStatus } from '@/types';

const COMMERCIAL_STATUSES = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.RESPONDED,
  LeadStatus.MEETING_SCHEDULED,
  LeadStatus.PROPOSAL_SENT,
  LeadStatus.NEGOTIATION,
  LeadStatus.WON,
];

export function LeadStatusStepper({
  status,
  pending,
  onSelect,
}: {
  status: LeadStatus;
  pending?: boolean;
  onSelect: (status: LeadStatus) => void;
}) {
  const { t } = useTranslation();
  const statuses = COMMERCIAL_STATUSES.includes(status)
    ? COMMERCIAL_STATUSES
    : [status, ...COMMERCIAL_STATUSES];

  return (
    <section className="rounded-card border border-[color:var(--border)] bg-[color:var(--surface-card)] p-4">
      <h2 className="mb-4 text-sm text-[color:var(--ink-muted)]">
        {t('clientFile.currentStatus')}
      </h2>
      <ol className="flex flex-wrap gap-2" aria-label={t('clientFile.statuses')}>
        {statuses.map((item) => {
          const meta = getLeadStatusMeta(item);
          return (
            <li key={item} className="min-w-28 flex-1">
              <button
                type="button"
                aria-current={item === status ? 'step' : undefined}
                disabled={pending || item === status}
                onClick={() => onSelect(item)}
                className="w-full rounded-full border px-3 py-2 text-left text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)] disabled:cursor-default"
                style={{
                  ...getLeadStatusStyle(item),
                  borderColor: item === status ? 'currentColor' : 'transparent',
                }}
              >
                {meta.label}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

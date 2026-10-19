import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchDashboardSummary } from '@/features/dashboard/api';
import { fetchLeads } from '@/features/leads/api';

/** Existing APIs expose creation dates and portfolio statuses, not today's transitions. */
export function TodaySummary() {
  const { t } = useTranslation();
  // The list endpoint normalizes calendar dates to UTC day boundaries.
  const [createdFrom, setCreatedFrom] = useState(() => new Date().toISOString().slice(0, 10));
  useEffect(() => {
    const timer = window.setInterval(
      () => setCreatedFrom(new Date().toISOString().slice(0, 10)),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const createdTo = createdFrom;
  const summary = useQuery({
    queryKey: ['dashboard', 'summary', { period: 'all' }],
    queryFn: () => fetchDashboardSummary({ period: 'all' }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const today = useQuery({
    queryKey: ['leads', 'today-summary', createdFrom, createdTo],
    queryFn: () => fetchLeads({ page: 1, pageSize: 1, createdFrom, createdTo }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const rows = [
    ['newClients', today.isError ? undefined : today.data?.meta.total],
    ['contacted', summary.isError ? undefined : summary.data?.contacted],
    ['qualified', summary.isError ? undefined : summary.data?.qualified],
    ['won', summary.isError ? undefined : summary.data?.won],
  ] as const;
  return (
    <section
      aria-label={t('todaySummary.title')}
      className="rounded-card border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-3 text-xs shadow-sm"
    >
      <h2 className="mb-3 text-sm font-medium text-[color:var(--ink)]">
        {t('todaySummary.title')}
      </h2>
      <dl className="space-y-2">
        {rows.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-2">
            <dt className="text-[color:var(--ink-secondary)]">{t(`todaySummary.${key}`)}</dt>
            <dd className="font-mono text-[color:var(--ink)]">
              {value === undefined ? t('common.dash') : value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>
      {summary.isError || today.isError ? (
        <p role="status" className="mt-2 text-[color:var(--ink-secondary)]">
          {t('todaySummary.unavailable')}
        </p>
      ) : null}
    </section>
  );
}

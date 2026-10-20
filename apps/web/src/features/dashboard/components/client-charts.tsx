import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getLeadStatusMeta } from '@/lib/lead-status';
import { LEAD_STATUS_COLORS } from '@/lib/lead-status-colors';
import type { DashboardCharts } from '@/types';

export function ClientDistribution({ rows }: { rows: DashboardCharts['byStatus'] }) {
  const { t } = useTranslation();
  const entries = rows.filter((row) => row.count > 0);
  const total = entries.reduce((sum, row) => sum + row.count, 0);
  let offset = 0;
  const slices = entries.map((row) => {
    const start = offset;
    offset += (row.count / total) * 100;
    return `${LEAD_STATUS_COLORS[row.status].light.pin} ${start}% ${offset}%`;
  });
  return (
    <Card>
      <CardHeader title={t('home.distribution')} />
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-[color:var(--ink-secondary)]">{t('home.emptyClients')}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-5">
            <div
              aria-hidden="true"
              className="flex h-36 w-36 shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(${slices.join(',')})` }}
            >
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[color:var(--bg-surface)]">
                <span className="font-mono text-2xl text-[color:var(--ink)]">{total}</span>
                <span className="text-xs text-[color:var(--ink-secondary)]">
                  {t('home.clients')}
                </span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2" aria-label={t('home.distribution')}>
              {entries.map((row) => (
                <li key={row.status} className="flex items-center gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: LEAD_STATUS_COLORS[row.status].light.pin }}
                  />
                  <span>{getLeadStatusMeta(row.status).label}</span>
                  <span className="ml-auto font-mono">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** An accessible daily series; SVG uses no animation and respects reduced motion. */
export function ClientEvolution({ rows }: { rows: Array<{ date: string; count: number }> }) {
  const { t, i18n } = useTranslation();
  const max = Math.max(1, ...rows.map((row) => row.count));
  const points = rows
    .map(
      (row, index) =>
        `${(index / Math.max(1, rows.length - 1)) * 400},${130 - (row.count / max) * 110}`,
    )
    .join(' ');
  const formatDate = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString(i18n.language, {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    });
  return (
    <Card>
      <CardHeader title={t('home.evolution')} description={t('home.last30Days')} />
      <CardContent>
        <p className="font-mono text-2xl">{rows.reduce((sum, row) => sum + row.count, 0)}</p>
        {rows.every((row) => row.count === 0) ? (
          <p className="my-3 text-sm text-[color:var(--ink-secondary)]">{t('home.emptyClients')}</p>
        ) : null}
        <svg aria-hidden="true" viewBox="0 0 400 150" className="mt-4 w-full overflow-visible">
          {[20, 75, 130].map((y) => (
            <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="var(--border-default)" />
          ))}
          <polygon points={`0,130 ${points} 400,130`} fill="var(--brand-soft)" />
          <polyline points={points} stroke="var(--accent)" strokeWidth="3" fill="none" />
        </svg>
        <div className="flex justify-between text-xs text-[color:var(--ink-secondary)]">
          <span>{rows[0] ? formatDate(rows[0].date) : ''}</span>
          <span>{rows.at(-1) ? formatDate(rows.at(-1)!.date) : ''}</span>
        </div>
        <details className="mt-3 text-sm text-[color:var(--ink-secondary)]">
          <summary className="cursor-pointer">{t('home.viewDailyData')}</summary>
          <table className="mt-2 w-full text-left">
            <caption className="sr-only">{t('home.evolution')}</caption>
            <thead>
              <tr>
                <th>{t('home.date')}</th>
                <th>{t('home.clients')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date}>
                  <td>{formatDate(row.date)}</td>
                  <td className="font-mono">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </CardContent>
    </Card>
  );
}

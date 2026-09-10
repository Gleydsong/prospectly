import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { reportLeadsPath, type ReportPeriod } from '@/features/reports/api';
import { useFunnelConversion } from '@/features/reports/hooks';
import { isReportsUnavailableError } from '@/features/reports/unavailable';
import { useAuthStore } from '@/stores/auth.store';
import { LeadSource, Role } from '@/types';

const PERIODS: ReportPeriod[] = ['7d', '30d', '90d'];
const SOURCES = Object.values(LeadSource);

export function ReportsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const [period, setPeriod] = useState<ReportPeriod>('30d');
  const [source, setSource] = useState<LeadSource | ''>('');
  const [mineOnly, setMineOnly] = useState(user?.role === Role.SALES);

  const filters = {
    period,
    source: source || undefined,
    ownerId: mineOnly ? user?.id : undefined,
  };
  const query = useFunnelConversion(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.groupConvert')}
        title={t('reports.title')}
        description={t('reports.subtitle')}
      />

      <Card
        className="border-amber-500/30 bg-amber-500/10 p-4 text-sm text-[color:var(--ink)]"
        role="note"
      >
        {t('reports.retentionNotice')}
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          id="report-period"
          label={t('reports.fields.period')}
          value={period}
          onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
        >
          {PERIODS.map((value) => (
            <option key={value} value={value}>
              {t(`reports.periods.${value}`)}
            </option>
          ))}
        </Select>
        <Select
          id="report-source"
          label={t('reports.fields.source')}
          value={source}
          onChange={(event) => setSource(event.target.value as LeadSource | '')}
        >
          <option value="">{t('reports.fields.sourceAll')}</option>
          {SOURCES.map((value) => (
            <option key={value} value={value}>
              {t(`reports.sources.${value}`)}
            </option>
          ))}
        </Select>
        <label
          htmlFor="report-mine-only"
          className="flex items-end gap-2 pb-2 text-sm font-semibold text-[color:var(--ink)]"
        >
          <input
            id="report-mine-only"
            type="checkbox"
            className="h-4 w-4 accent-[color:var(--ink)]"
            checked={mineOnly}
            onChange={(event) => setMineOnly(event.target.checked)}
          />
          {t('reports.fields.mineOnly')}
        </label>
      </div>

      {query.isLoading ? (
        <TableSkeleton rows={4} />
      ) : query.isError ? (
        <Alert
          tone="error"
          action={
            <Button type="button" variant="ghost" size="sm" onClick={() => void query.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {isReportsUnavailableError(query.error) ? t('reports.unavailable') : t('reports.loadError')}
        </Alert>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Kpi
              label={t('reports.kpis.inflow')}
              value={query.data?.inflow ?? 0}
              href={
                (query.data?.inflow ?? 0) > 0
                  ? reportLeadsPath('inflow', filters)
                  : undefined
              }
              openLabel={t('reports.openBucket', {
                label: t('reports.kpis.inflow'),
                count: query.data?.inflow ?? 0,
              })}
            />
            <Kpi
              label={t('reports.kpis.wins')}
              value={query.data?.wins ?? 0}
              href={(query.data?.wins ?? 0) > 0 ? reportLeadsPath('wins', filters) : undefined}
              openLabel={t('reports.openBucket', {
                label: t('reports.kpis.wins'),
                count: query.data?.wins ?? 0,
              })}
            />
            <Kpi
              label={t('reports.kpis.losses')}
              value={query.data?.losses ?? 0}
              href={(query.data?.losses ?? 0) > 0 ? reportLeadsPath('losses', filters) : undefined}
              openLabel={t('reports.openBucket', {
                label: t('reports.kpis.losses'),
                count: query.data?.losses ?? 0,
              })}
            />
            <Kpi
              label={t('reports.kpis.winRate')}
              value={`${(query.data?.winRate ?? 0).toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 1,
              })}%`}
            />
          </div>

          <Card>
            <CardHeader title={t('reports.breakdownTitle')} />
            <CardContent className="overflow-x-auto p-0">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--ink-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('reports.columns.source')}</th>
                    <th className="px-4 py-3 font-medium">{t('reports.kpis.inflow')}</th>
                    <th className="px-4 py-3 font-medium">{t('reports.kpis.wins')}</th>
                    <th className="px-4 py-3 font-medium">{t('reports.kpis.losses')}</th>
                    <th className="px-4 py-3 font-medium">{t('reports.kpis.winRate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(query.data?.bySource ?? []).length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-[color:var(--ink-muted)]" colSpan={5}>
                        {t('reports.empty')}
                      </td>
                    </tr>
                  ) : (
                    query.data?.bySource.map((row) => (
                      <tr
                        key={row.source}
                        className="border-b border-[color:var(--border)] text-[color:var(--ink)]"
                      >
                        <td className="px-4 py-3">
                          {t(`reports.sources.${row.source}`, { defaultValue: row.source })}
                        </td>
                        <td className="px-4 py-3">
                          <BucketCell
                            count={row.inflow}
                            href={reportLeadsPath('inflow', {
                              ...filters,
                              source: row.source as LeadSource,
                            })}
                            label={t('reports.openSourceBucket', {
                              label: t('reports.kpis.inflow'),
                              source: t(`reports.sources.${row.source}`, {
                                defaultValue: row.source,
                              }),
                              count: row.inflow,
                            })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <BucketCell
                            count={row.wins}
                            href={reportLeadsPath('wins', {
                              ...filters,
                              source: row.source as LeadSource,
                            })}
                            label={t('reports.openSourceBucket', {
                              label: t('reports.kpis.wins'),
                              source: t(`reports.sources.${row.source}`, {
                                defaultValue: row.source,
                              }),
                              count: row.wins,
                            })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <BucketCell
                            count={row.losses}
                            href={reportLeadsPath('losses', {
                              ...filters,
                              source: row.source as LeadSource,
                            })}
                            label={t('reports.openSourceBucket', {
                              label: t('reports.kpis.losses'),
                              source: t(`reports.sources.${row.source}`, {
                                defaultValue: row.source,
                              }),
                              count: row.losses,
                            })}
                          />
                        </td>
                        <td className="px-4 py-3">{row.winRate}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  href,
  openLabel,
}: {
  label: string;
  value: number | string;
  href?: string;
  openLabel?: string;
}) {
  const body = (
    <Card className="p-4" interactive={Boolean(href)}>
      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--ink-muted)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-[color:var(--ink)]">{value}</p>
    </Card>
  );
  if (!href) return body;
  return (
    <Link
      to={href}
      className="block rounded-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
      aria-label={openLabel}
    >
      {body}
    </Link>
  );
}

function BucketCell({ count, href, label }: { count: number; href: string; label: string }) {
  if (count <= 0) return <>{count}</>;
  return (
    <Link
      to={href}
      className="font-semibold text-[color:var(--accent)] hover:underline"
      aria-label={label}
    >
      {count}
    </Link>
  );
}

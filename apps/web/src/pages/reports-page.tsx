import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { canWriteSavedReport } from '@/features/reports/can-write-saved-report';
import { reportLeadsPath, type ReportPeriod } from '@/features/reports/api';
import {
  useArchiveSavedReport,
  useCreateSavedReport,
  useFunnelConversion,
  useSavedReports,
} from '@/features/reports/hooks';
import {
  fetchSavedReportConversion,
  savedReportToFilters,
  type SavedReport,
} from '@/features/reports/saved-reports-api';
import { isReportsUnavailableError } from '@/features/reports/unavailable';
import { getApiErrorMessage } from '@/lib/api';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');

  const canSave = canWriteSavedReport(user?.role);
  const savedReports = useSavedReports();
  const createSaved = useCreateSavedReport();
  const archiveSaved = useArchiveSavedReport();
  const selected = (savedReports.data ?? []).find((row) => row.id === selectedId) ?? null;

  const ephemeralFilters = {
    period,
    source: source || undefined,
    ownerId: mineOnly ? user?.id : undefined,
  };
  const filters = selected ? savedReportToFilters(selected) : ephemeralFilters;
  const ephemeralQuery = useFunnelConversion(ephemeralFilters, { enabled: !selectedId });
  const savedQuery = useQuery({
    queryKey: ['saved-reports', selectedId, 'funnel-conversion'],
    queryFn: () => fetchSavedReportConversion(selectedId!),
    enabled: Boolean(selectedId),
    retry: false,
  });
  const query = selectedId ? savedQuery : ephemeralQuery;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.groupConvert')}
        title={t('reports.title')}
        description={t('reports.subtitle')}
      />

      <SavedReportsPanel
        canSave={canSave}
        saveName={saveName}
        onSaveNameChange={setSaveName}
        onSave={() => {
          const name = saveName.trim();
          if (!name) return;
          createSaved.mutate(
            {
              name,
              definition: {
                period: ephemeralFilters.period,
                ...(ephemeralFilters.source ? { source: ephemeralFilters.source } : {}),
                ...(ephemeralFilters.ownerId ? { ownerId: ephemeralFilters.ownerId } : {}),
              },
            },
            {
              onSuccess: (created) => {
                setSaveName('');
                setSelectedId(created.id);
              },
            },
          );
        }}
        saving={createSaved.isPending}
        saveError={createSaved.isError ? getApiErrorMessage(createSaved.error) : null}
        reports={savedReports.data ?? []}
        selectedId={selectedId}
        onSelect={(report) => setSelectedId(report.id)}
        onClear={() => setSelectedId(null)}
        onArchive={(id) => {
          archiveSaved.mutate(id, {
            onSuccess: () => {
              if (selectedId === id) setSelectedId(null);
            },
          });
        }}
        listError={savedReports.isError}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          id="report-period"
          label={t('reports.fields.period')}
          value={period}
          onChange={(event) => {
            setSelectedId(null);
            setPeriod(event.target.value as ReportPeriod);
          }}
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
          onChange={(event) => {
            setSelectedId(null);
            setSource(event.target.value as LeadSource | '');
          }}
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
            onChange={(event) => {
              setSelectedId(null);
              setMineOnly(event.target.checked);
            }}
          />
          {t('reports.fields.mineOnly')}
        </label>
      </div>

      {query.isLoading ? (
        <TableSkeleton rows={4} />
      ) : query.isError ? (
        <Alert tone="error">
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

function SavedReportsPanel({
  canSave,
  saveName,
  onSaveNameChange,
  onSave,
  saving,
  saveError,
  reports,
  selectedId,
  onSelect,
  onClear,
  onArchive,
  listError,
}: {
  canSave: boolean;
  saveName: string;
  onSaveNameChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
  reports: SavedReport[];
  selectedId: string | null;
  onSelect: (report: SavedReport) => void;
  onClear: () => void;
  onArchive: (id: string) => void;
  listError: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader
        className="px-6 py-5 sm:px-8"
        title={t('reports.savedTitle')}
        description={t('reports.savedDesc')}
      />
      <CardContent className="space-y-4 px-6 pb-6 sm:px-8 sm:pb-8">
        {canSave ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              id="saved-report-name"
              className="h-11 max-w-md"
              label={t('reports.savedName')}
              value={saveName}
              onChange={(event) => onSaveNameChange(event.target.value)}
              maxLength={120}
            />
            <Button
              type="button"
              disabled={!saveName.trim() || saving}
              loading={saving}
              onClick={onSave}
            >
              {t('reports.savedCreate')}
            </Button>
          </div>
        ) : null}
        {saveError ? <Alert tone="error">{saveError}</Alert> : null}
        {listError ? <Alert tone="error">{t('reports.savedLoadError')}</Alert> : null}
        {reports.length === 0 ? (
          <p className="text-sm text-[color:var(--ink-muted)]">{t('reports.savedEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((report) => {
              const selected = report.id === selectedId;
              return (
                <li
                  key={report.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-panel border border-[color:var(--border)] px-3 py-2"
                >
                  <button
                    type="button"
                    className="min-w-0 text-left text-sm font-semibold text-[color:var(--ink)] hover:underline"
                    aria-pressed={selected}
                    onClick={() => onSelect(report)}
                  >
                    {report.name}
                  </button>
                  <div className="flex items-center gap-2">
                    {selected ? (
                      <Button type="button" size="sm" variant="glass" onClick={onClear}>
                        {t('reports.savedClear')}
                      </Button>
                    ) : null}
                    {report.canEdit ? (
                      <Button type="button" size="sm" variant="glass" onClick={() => onArchive(report.id)}>
                        {t('reports.savedArchive')}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

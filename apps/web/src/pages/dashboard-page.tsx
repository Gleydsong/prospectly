import { useQuery } from '@tanstack/react-query';
import { Check, MapPin, Phone, TrendingUp } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { fetchDashboardSummary } from '@/features/dashboard/api';
import { ClientDistribution, ClientEvolution } from '@/features/dashboard/components/client-charts';
import { LeadsMapCard } from '@/features/dashboard/components/leads-map-card';

const LeadFormModal = lazy(() =>
  import('@/features/leads/components/lead-form-modal').then((m) => ({ default: m.LeadFormModal })),
);

const metrics = [
  { key: 'clients', icon: MapPin },
  { key: 'contacted', icon: Phone },
  { key: 'qualified', icon: Check },
  { key: 'won', icon: TrendingUp },
] as const;

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const summary = useQuery({
    queryKey: ['dashboard', 'summary', { period: '30d' }],
    queryFn: () => fetchDashboardSummary({ period: '30d' }),
  });
  const data = summary.data;
  const overview = data?.overview;
  const actions = overview?.nextActions ?? [];
  const dateTime = (date: string) =>
    new Date(date).toLocaleString(i18n.language, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  const loading = (
    <p role="status" className="text-sm text-[color:var(--ink-secondary)]">
      {t('common.loading')}
    </p>
  );
  const summaryError = summary.isError ? (
    <Alert tone="error">
      {t('dashboard.loadError')}{' '}
      <Button variant="outline" onClick={() => void summary.refetch()}>
        {t('common.retry')}
      </Button>
    </Alert>
  ) : null;

  return (
    <div className="space-y-5 text-[color:var(--ink)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('nav.principal')}</h1>
          <p className="mt-1 text-sm text-[color:var(--ink-secondary)]">{t('home.last30Days')}</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-control bg-[color:var(--brand)] px-4 py-3 text-sm font-semibold text-white"
        >
          + {t('home.newClient')}
        </button>
      </header>
      {summaryError}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ key, icon: Icon }) => {
          const metric = overview?.kpis[key];
          return (
            <Card key={key} role="group" aria-label={t(`home.${key}`)}>
              <CardContent>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm text-[color:var(--ink-secondary)]">
                      {t(`home.${key}`)}
                    </h2>
                    <p className="mt-2 font-mono text-3xl">
                      {summary.isPending
                        ? '…'
                        : summary.isError || !metric
                          ? '—'
                          : metric.value.toLocaleString(i18n.language)}
                    </p>
                  </div>
                  <span className="rounded-control bg-[color:var(--brand-soft)] p-2.5 text-[color:var(--accent)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-3 text-xs text-[color:var(--ink-secondary)]">
                  {summary.isPending
                    ? t('common.loading')
                    : summary.isError || !metric
                      ? '—'
                      : metric.changePercent === null
                        ? t('home.noBaseline')
                        : t('home.change', {
                            value: new Intl.NumberFormat(i18n.language, {
                              signDisplay: 'exceptZero',
                              maximumFractionDigits: 1,
                            }).format(metric.changePercent),
                          })}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-[color:var(--ink-secondary)]">{t('home.metricDefinition')}</p>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <LeadsMapCard />
          <Card>
            <CardHeader
              title={t('home.nextActions')}
              action={
                <Link className="text-sm font-medium text-[color:var(--accent)]" to="/tasks">
                  {t('home.viewAll')} →
                </Link>
              }
            />
            <CardContent>
              {summary.isPending ? (
                loading
              ) : summary.isError || !overview ? (
                <p>{t('home.unavailable')}</p>
              ) : actions.length === 0 ? (
                <p className="text-sm text-[color:var(--ink-secondary)]">
                  {t('home.emptyActions')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {actions.map((action) => (
                    <li key={action.id}>
                      <Link
                        to="/tasks"
                        className="flex flex-wrap items-center justify-between gap-3 rounded-control p-3 odd:bg-[color:var(--bg-subtle)] hover:bg-[color:var(--bg-subtle)]"
                      >
                        <div>
                          <p className="text-sm font-semibold">
                            {action.lead?.companyName ?? action.title}
                          </p>
                          <p className="mt-1 text-xs text-[color:var(--ink-secondary)]">
                            {action.lead ? action.title : t('home.scheduledTask')}
                          </p>
                        </div>
                        <time
                          className="font-mono text-xs text-[color:var(--ink-secondary)]"
                          dateTime={action.dueAt}
                        >
                          {dateTime(action.dueAt)}
                        </time>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="min-w-0 space-y-5">
          {summary.isPending ? (
            <Card>
              <CardHeader title={t('home.distribution')} />
              <CardContent>{loading}</CardContent>
            </Card>
          ) : overview && !summary.isError ? (
            <ClientDistribution rows={overview.byStatus} />
          ) : (
            <Card>
              <CardHeader title={t('home.distribution')} />
              <CardContent>{t('home.unavailable')}</CardContent>
            </Card>
          )}
          {summary.isPending ? (
            <Card>
              <CardHeader title={t('home.evolution')} />
              <CardContent>{loading}</CardContent>
            </Card>
          ) : overview && !summary.isError ? (
            <ClientEvolution rows={overview.dailyCreated} />
          ) : (
            <Card>
              <CardHeader title={t('home.evolution')} />
              <CardContent>{t('home.unavailable')}</CardContent>
            </Card>
          )}
          <Card>
            <CardHeader title={t('home.recentActivity')} />
            <CardContent>
              {summary.isPending ? (
                loading
              ) : summary.isError || !overview ? (
                <p>{t('home.unavailable')}</p>
              ) : overview.recentActivity.length === 0 ? (
                <p className="text-sm text-[color:var(--ink-secondary)]">
                  {t('home.emptyActivity')}
                </p>
              ) : (
                <ul className="space-y-4">
                  {overview.recentActivity.map((activity) => (
                    <li key={activity.id} className="flex items-start gap-3">
                      <Check
                        className="mt-1 h-4 w-4 shrink-0 text-[color:var(--accent)]"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/clientes/${activity.lead.id}`}
                          className="text-sm font-semibold hover:underline"
                        >
                          {activity.lead.companyName}
                        </Link>
                        <p className="mt-1 text-xs text-[color:var(--ink-secondary)]">
                          {t(`clientFile.activityTypes.${activity.type}`, {
                            defaultValue: t('home.activity'),
                          })}
                        </p>
                        <time
                          className="mt-1 block font-mono text-xs text-[color:var(--ink-secondary)]"
                          dateTime={activity.createdAt}
                        >
                          {dateTime(activity.createdAt)}
                        </time>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {createOpen ? (
        <Suspense fallback={loading}>
          <LeadFormModal open onClose={() => setCreateOpen(false)} />
        </Suspense>
      ) : null}
    </div>
  );
}

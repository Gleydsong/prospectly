import { useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  FileText,
  Handshake,
  Target,
  UserPlus,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchDashboardCharts, fetchDashboardSummary } from '@/features/dashboard/api';
import { getLeadStatusLabel, getLeadStatusShortLabel } from '@/lib/lead-status';
import { formatDate } from '@/lib/utils';

const PIE_COLORS = ['#059669', '#0d9488', '#0ea5e9', '#14b8a6', '#f59e0b', '#f97316', '#047857', '#38bdf8'];

const SCORE_BUCKET_LABELS: Record<string, string> = {
  '0-29': '0–29',
  '30-59': '30–59',
  '60-79': '60–79',
  '80-100': '80–100',
};

function scoreBucketLabel(bucket: string): string {
  return SCORE_BUCKET_LABELS[bucket] ?? bucket;
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-control bg-brand-50">
          <Icon className="h-5 w-5 text-brand-600" aria-hidden />
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-tight text-zinc-900">{value}</p>
          <p className="text-sm text-zinc-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const summary = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: fetchDashboardSummary });
  const charts = useQuery({ queryKey: ['dashboard', 'charts'], queryFn: fetchDashboardCharts });

  if (summary.isError) {
    return (
      <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
        {t('dashboard.loadError')}
      </p>
    );
  }

  const data = summary.data;

  const statusChartData =
    charts.data?.byStatus.map((entry) => ({
      status: entry.status,
      label: getLeadStatusShortLabel(entry.status),
      fullLabel: getLeadStatusLabel(entry.status),
      count: entry.count,
    })) ?? [];

  const scoreChartData =
    charts.data?.byScore.map((entry) => ({
      ...entry,
      label: scoreBucketLabel(entry.bucket),
    })) ?? [];

  return (
    <div className="space-y-6" key={i18n.language}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t('dashboard.title')}</h1>
        <p className="text-sm text-zinc-500">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summary.isLoading || !data ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-20" />)
        ) : (
          <>
            <StatCard label={t('dashboard.totalLeads')} value={data.totalLeads} icon={Users} />
            <StatCard label={t('dashboard.newLeads')} value={data.newLeads} icon={UserPlus} />
            <StatCard label={t('dashboard.meetings')} value={data.meetings} icon={CalendarClock} />
            <StatCard label={t('dashboard.proposals')} value={data.proposals} icon={FileText} />
            <StatCard label={t('dashboard.won')} value={data.won} icon={Handshake} />
            <StatCard label={t('dashboard.conversion')} value={`${data.conversionRate}%`} icon={Target} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('dashboard.byStatus')} />
          <CardContent className="h-72">
            {charts.isLoading || !charts.data ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#52525b' }}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={72}
                    tickMargin={6}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#52525b' }} width={32} />
                  <Tooltip
                    formatter={(value: number) => [value, t('dashboard.leadsSeries')]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as { fullLabel?: string; label?: string } | undefined;
                      return row?.fullLabel ?? row?.label ?? '';
                    }}
                  />
                  <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} name={t('dashboard.leadsSeries')} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title={t('dashboard.byScore')} />
          <CardContent className="h-72">
            {charts.isLoading || !charts.data ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scoreChartData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={55}
                    outerRadius={90}
                    label={({ label, count }) => `${label}: ${count}`}
                  >
                    {scoreChartData.map((entry, index) => (
                      <Cell key={entry.bucket} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('dashboard.topOpportunities')} description={t('dashboard.topOpportunitiesDesc')} />
          <CardContent className="space-y-3">
            {!data || data.topOpportunities.length === 0 ? (
              <p className="text-sm text-zinc-500">{t('dashboard.noLeads')}</p>
            ) : (
              data.topOpportunities.map((lead) => (
                <Link
                  key={lead.id}
                  to={`/leads/${lead.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">{lead.companyName}</p>
                    <p className="text-xs text-zinc-500">{lead.city ?? t('common.dash')}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <LeadStatusBadge status={lead.status} />
                    <ScoreBadge score={lead.score} />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title={t('dashboard.upcoming')} />
          <CardContent className="space-y-3">
            {!data || data.upcomingFollowUps.length === 0 ? (
              <p className="text-sm text-zinc-500">{t('dashboard.noFollowUps')}</p>
            ) : (
              data.upcomingFollowUps.map((item) => (
                <Link
                  key={item.id}
                  to={`/leads/${item.id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50"
                >
                  <span className="text-sm font-medium text-zinc-900">{item.companyName}</span>
                  <span className="text-xs text-zinc-500">{formatDate(item.nextContactAt)}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

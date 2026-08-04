import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  FileText,
  Handshake,
  Target,
  UserPlus,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchDashboardCharts, fetchDashboardSummary } from '@/features/dashboard/api';
import { fetchOrganizationMembers } from '@/features/organizations/api';
import { getLeadStatusLabel, getLeadStatusShortLabel } from '@/lib/lead-status';
import { formatDate } from '@/lib/utils';
import { DashboardPeriod, LeadSource } from '@/types';

const PIE_COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#f59e0b', '#f97316', '#1d4ed8', '#38bdf8'];

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
        <div className="flex h-11 w-11 items-center justify-center rounded-control bg-brand-500/15">
          <Icon className="h-5 w-5 text-brand-400" aria-hidden />
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-tight text-zinc-50">{value}</p>
          <p className="text-sm text-zinc-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  const [source, setSource] = useState<LeadSource | ''>('');
  const [ownerId, setOwnerId] = useState('');
  const [segment, setSegment] = useState('');

  const filters = {
    period,
    ...(source ? { source } : {}),
    ...(ownerId ? { ownerId } : {}),
    ...(segment.trim() ? { segment: segment.trim() } : {}),
  };

  const members = useQuery({
    queryKey: ['organizations', 'members'],
    queryFn: fetchOrganizationMembers,
  });

  const summary = useQuery({
    queryKey: ['dashboard', 'summary', filters],
    queryFn: () => fetchDashboardSummary(filters),
  });
  const charts = useQuery({
    queryKey: ['dashboard', 'charts', filters],
    queryFn: () => fetchDashboardCharts(filters),
  });

  if (summary.isError) {
    return (
      <p className="rounded-lg bg-red-500/10 p-4 text-sm text-red-300" role="alert">
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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{t('dashboard.title')}</h1>
        <p className="text-sm text-zinc-500">{t('dashboard.subtitle')}</p>
      </div>

      <Card className="p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
          {t('dashboard.filters')}
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select
            label={t('dashboard.period')}
            value={period}
            onChange={(event) => setPeriod(event.target.value as DashboardPeriod)}
          >
            <option value="7d">{t('dashboard.period7d')}</option>
            <option value="30d">{t('dashboard.period30d')}</option>
            <option value="90d">{t('dashboard.period90d')}</option>
            <option value="all">{t('dashboard.periodAll')}</option>
          </Select>
          <Select
            label={t('dashboard.source')}
            value={source}
            onChange={(event) => setSource(event.target.value as LeadSource | '')}
          >
            <option value="">{t('dashboard.allSources')}</option>
            {Object.values(LeadSource).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <Select
            label={t('dashboard.owner')}
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
          >
            <option value="">{t('dashboard.allOwners')}</option>
            {(members.data ?? []).map((member) => (
              <option key={member.user.id} value={member.user.id}>
                {member.user.name}
              </option>
            ))}
          </Select>
          <Input
            label={t('dashboard.segment')}
            placeholder={t('dashboard.allSegments')}
            value={segment}
            onChange={(event) => setSegment(event.target.value)}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.isLoading || !data ? (
          Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-20" />)
        ) : (
          <>
            <StatCard label={t('dashboard.totalLeads')} value={data.totalLeads} icon={Users} />
            <StatCard label={t('dashboard.newLeads')} value={data.newLeads} icon={UserPlus} />
            <StatCard label={t('dashboard.meetings')} value={data.meetings} icon={CalendarClock} />
            <StatCard label={t('dashboard.proposals')} value={data.proposals} icon={FileText} />
            <StatCard label={t('dashboard.won')} value={data.won} icon={Handshake} />
            <StatCard label={t('dashboard.lost')} value={data.lost} icon={AlertTriangle} />
            <StatCard label={t('dashboard.conversion')} value={`${data.conversionRate}%`} icon={Target} />
            <StatCard label={t('dashboard.overdueTasks')} value={data.overdueTasks} icon={AlertTriangle} />
          </>
        )}
      </div>

      {!summary.isLoading && data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t('dashboard.approachRate')} value={`${data.approachRate ?? 0}%`} icon={Target} />
          <StatCard label={t('dashboard.meetingRate')} value={`${data.meetingRate ?? 0}%`} icon={CalendarClock} />
          <StatCard label={t('dashboard.followUpRate')} value={`${data.followUpRate ?? 0}%`} icon={AlertTriangle} />
          <StatCard label={t('dashboard.lossRate')} value={`${data.lossRate ?? 0}%`} icon={AlertTriangle} />
        </div>
      ) : null}

      <Card>
        <CardHeader title={t('dashboard.recommendations')} />
        <CardContent className="space-y-3">
          {summary.isLoading || !data ? (
            <Skeleton className="h-24" />
          ) : !data.recommendations || data.recommendations.length === 0 ? (
            <p className="text-sm text-zinc-500">{t('dashboard.recommendationsEmpty')}</p>
          ) : (
            data.recommendations.map((rec) => (
              <Link
                key={rec.code}
                to={rec.href}
                className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800 p-3 hover:bg-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-50">
                    {t(`dashboard.rec.${rec.code}`, { count: rec.count })}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{rec.severity}</p>
                </div>
                <span className="shrink-0 text-xs text-brand-300">{rec.count}</span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

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
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} name={t('dashboard.leadsSeries')} />
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

      <Card>
        <CardHeader title={t('dashboard.conversionBySource')} />
        <CardContent>
          {!data || data.conversionBySource.length === 0 ? (
            <p className="text-sm text-zinc-500">{t('dashboard.noLeads')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-3 py-2 font-medium">{t('dashboard.source')}</th>
                    <th className="px-3 py-2 font-medium">{t('dashboard.sourceTotal')}</th>
                    <th className="px-3 py-2 font-medium">{t('dashboard.sourceWon')}</th>
                    <th className="px-3 py-2 font-medium">{t('dashboard.sourceLost')}</th>
                    <th className="px-3 py-2 font-medium">{t('dashboard.conversion')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.conversionBySource.map((row) => (
                    <tr key={row.source} className="border-b border-zinc-800">
                      <td className="px-3 py-2 text-zinc-100">{row.source}</td>
                      <td className="px-3 py-2 text-zinc-300">{row.total}</td>
                      <td className="px-3 py-2 text-emerald-400">{row.won}</td>
                      <td className="px-3 py-2 text-red-400">{row.lost}</td>
                      <td className="px-3 py-2 text-zinc-300">{row.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 p-3 hover:bg-zinc-950"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-50">{lead.companyName}</p>
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
          <CardHeader title={t('dashboard.overdueFollowUps')} />
          <CardContent className="space-y-3">
            {!data || data.overdueFollowUps.length === 0 ? (
              <p className="text-sm text-zinc-500">{t('dashboard.noOverdue')}</p>
            ) : (
              data.overdueFollowUps.map((item) => (
                <Link
                  key={item.id}
                  to={`/leads/${item.id}`}
                  className="flex items-center justify-between rounded-lg border border-red-900/40 bg-red-500/5 p-3 hover:bg-red-500/10"
                >
                  <span className="text-sm font-medium text-zinc-50">{item.companyName}</span>
                  <span className="text-xs text-red-300">{formatDate(item.nextContactAt)}</span>
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
                  className="flex items-center justify-between rounded-lg border border-zinc-800 p-3 hover:bg-zinc-950"
                >
                  <span className="text-sm font-medium text-zinc-50">{item.companyName}</span>
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

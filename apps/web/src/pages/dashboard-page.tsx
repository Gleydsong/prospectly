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

import { Alert } from '@/components/ui/alert';
import { BentoGrid, BentoItem } from '@/components/ui/bento-grid';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchDashboardCharts, fetchDashboardSummary } from '@/features/dashboard/api';
import { fetchOrganizationMembers } from '@/features/organizations/api';
import { getLeadStatusLabel, getLeadStatusShortLabel } from '@/lib/lead-status';
import { formatDate } from '@/lib/utils';
import { DashboardPeriod, LeadSource } from '@/types';

const PIE_COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#f59e0b', '#f97316', '#1d4ed8', '#38bdf8'];

const AXIS_TICK = { fontSize: 11, fill: '#7C8593' } as const;

const TOOLTIP_STYLE = {
  background: '#15181D',
  border: '1px solid rgb(255 255 255 / 0.1)',
  borderRadius: 14,
  color: '#F1F2F4',
  fontSize: 12,
} as const;

const SCORE_BUCKET_LABELS: Record<string, string> = {
  '0-29': '0–29',
  '30-59': '30–59',
  '60-79': '60–79',
  '80-100': '80–100',
};

function scoreBucketLabel(bucket: string): string {
  return SCORE_BUCKET_LABELS[bucket] ?? bucket;
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
    return <Alert tone="error">{t('dashboard.loadError')}</Alert>;
  }

  const data = summary.data;
  const loadingSummary = summary.isLoading || !data;

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
      <PageHeader
        eyebrow={t('nav.groupOverview')}
        title={t('dashboard.title')}
        description={t('dashboard.subtitle')}
      />

      <Card className="p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
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
        <MetricCard
          emphasis
          label={t('dashboard.totalLeads')}
          value={data?.totalLeads ?? 0}
          hint={t('dashboard.newLeads')}
          icon={Users}
          loading={loadingSummary}
        />
        <MetricCard
          label={t('dashboard.newLeads')}
          value={data?.newLeads ?? 0}
          icon={UserPlus}
          loading={loadingSummary}
        />
        <MetricCard
          label={t('dashboard.meetings')}
          value={data?.meetings ?? 0}
          icon={CalendarClock}
          loading={loadingSummary}
        />
        <MetricCard
          label={t('dashboard.conversion')}
          value={`${data?.conversionRate ?? 0}%`}
          icon={Target}
          loading={loadingSummary}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t('dashboard.proposals')}
          value={data?.proposals ?? 0}
          icon={FileText}
          loading={loadingSummary}
        />
        <MetricCard
          label={t('dashboard.won')}
          value={data?.won ?? 0}
          icon={Handshake}
          loading={loadingSummary}
        />
        <MetricCard
          label={t('dashboard.lost')}
          value={data?.lost ?? 0}
          icon={AlertTriangle}
          loading={loadingSummary}
        />
        <MetricCard
          label={t('dashboard.overdueTasks')}
          value={data?.overdueTasks ?? 0}
          icon={AlertTriangle}
          loading={loadingSummary}
        />
      </div>

      {!loadingSummary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={t('dashboard.approachRate')}
            value={`${data.approachRate ?? 0}%`}
            icon={Target}
          />
          <MetricCard
            label={t('dashboard.meetingRate')}
            value={`${data.meetingRate ?? 0}%`}
            icon={CalendarClock}
          />
          <MetricCard
            label={t('dashboard.followUpRate')}
            value={`${data.followUpRate ?? 0}%`}
            icon={AlertTriangle}
          />
          <MetricCard
            label={t('dashboard.lossRate')}
            value={`${data.lossRate ?? 0}%`}
            icon={AlertTriangle}
          />
        </div>
      ) : null}

      <BentoGrid>
        <BentoItem span={4}>
          <Card surface="accent" className="h-full">
            <CardHeader title={t('dashboard.recommendations')} />
            <CardContent className="space-y-3">
              {loadingSummary ? (
                <Skeleton className="h-24" />
              ) : !data.recommendations || data.recommendations.length === 0 ? (
                <p className="text-sm text-zinc-500">{t('dashboard.recommendationsEmpty')}</p>
              ) : (
                data.recommendations.map((rec) => (
                  <Link
                    key={rec.code}
                    to={rec.href}
                    className="flex items-start justify-between gap-3 rounded-control border border-white/10 bg-white/[0.03] p-3 transition-colors hover:border-white/20 hover:bg-white/[0.07]"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-50">
                        {t(`dashboard.rec.${rec.code}`, { count: rec.count })}
                      </p>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                        {rec.severity}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-brand-300">
                      {rec.count}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </BentoItem>

        <BentoItem span={8}>
          <Card surface="bento" className="h-full">
            <CardHeader title={t('dashboard.byStatus')} />
            <CardContent className="h-72">
              {charts.isLoading || !charts.data ? (
                <Skeleton className="h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <XAxis
                      dataKey="label"
                      tick={AXIS_TICK}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={72}
                      tickMargin={6}
                    />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} width={32} />
                    <Tooltip
                      cursor={{ fill: 'rgb(255 255 255 / 0.04)' }}
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: number) => [value, t('dashboard.leadsSeries')]}
                      labelFormatter={(_, payload) => {
                        const row = payload?.[0]?.payload as { fullLabel?: string; label?: string } | undefined;
                        return row?.fullLabel ?? row?.label ?? '';
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} name={t('dashboard.leadsSeries')} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </BentoItem>

        <BentoItem span={5}>
          <Card surface="bento" className="h-full">
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
                      stroke="#090A0C"
                      strokeWidth={2}
                      label={({ label, count }) => `${label}: ${count}`}
                    >
                      {scoreChartData.map((entry, index) => (
                        <Cell key={entry.bucket} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: number, name: string) => [value, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </BentoItem>

        <BentoItem span={7}>
          <Card surface="bento" className="h-full">
            <CardHeader title={t('dashboard.conversionBySource')} />
            <CardContent>
              {!data || data.conversionBySource.length === 0 ? (
                <p className="text-sm text-zinc-500">{t('dashboard.noLeads')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-xs uppercase tracking-[0.12em] text-zinc-500">
                        <th className="px-3 py-2 font-medium">{t('dashboard.source')}</th>
                        <th className="px-3 py-2 font-medium">{t('dashboard.sourceTotal')}</th>
                        <th className="px-3 py-2 font-medium">{t('dashboard.sourceWon')}</th>
                        <th className="px-3 py-2 font-medium">{t('dashboard.sourceLost')}</th>
                        <th className="px-3 py-2 font-medium">{t('dashboard.conversion')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.conversionBySource.map((row) => (
                        <tr key={row.source} className="border-b border-white/[0.06]">
                          <td className="px-3 py-2 text-zinc-100">{row.source}</td>
                          <td className="px-3 py-2 tabular-nums text-zinc-300">{row.total}</td>
                          <td className="px-3 py-2 tabular-nums text-emerald-400">{row.won}</td>
                          <td className="px-3 py-2 tabular-nums text-red-400">{row.lost}</td>
                          <td className="px-3 py-2 tabular-nums text-zinc-300">{row.conversionRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </BentoItem>
      </BentoGrid>

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
                  className="flex items-center justify-between gap-3 rounded-control border border-white/[0.08] p-3 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
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
                  className="flex items-center justify-between rounded-control border border-red-500/25 bg-red-500/[0.07] p-3 transition-colors hover:bg-red-500/15"
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
                  className="flex items-center justify-between rounded-control border border-white/[0.08] p-3 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
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

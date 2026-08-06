import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  FileText,
  Handshake,
  Target,
  UserPlus,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

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
import { AccentBarChart } from '@/features/dashboard/components/accent-bar-chart';
import { ActionNextCard } from '@/features/dashboard/components/action-next-card';
import { DashboardFirstReveal } from '@/features/dashboard/components/dashboard-first-reveal';
import { DashboardWave } from '@/features/dashboard/components/dashboard-wave';
import { GaugePair } from '@/features/dashboard/components/gauge-pair';
import { HeroKpiCard } from '@/features/dashboard/components/hero-kpi-card';
import { LeadsMapCard } from '@/features/dashboard/components/leads-map-card';
import { PerformanceGauges } from '@/features/dashboard/components/performance-gauges';
import { useDashboardFirstReveal } from '@/features/dashboard/components/use-dashboard-first-reveal';
import { fetchDashboardCharts, fetchDashboardSummary } from '@/features/dashboard/api';
import { fetchOrganizationMembers } from '@/features/organizations/api';
import { formatDate } from '@/lib/utils';
import { DashboardPeriod, LeadSource } from '@/types';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  const [source, setSource] = useState<LeadSource | ''>('');
  const [ownerId, setOwnerId] = useState('');
  const [segment, setSegment] = useState('');
  const reveal = useDashboardFirstReveal();

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

  const data = summary.data;
  const loadingSummary = summary.isLoading || !data;
  const loadingCharts = charts.isLoading || !charts.data;

  const avgScore = useMemo(() => {
    const buckets = charts.data?.byScore ?? [];
    if (buckets.length === 0) return 0;
    const mid: Record<string, number> = {
      '0-29': 15,
      '30-59': 45,
      '60-79': 70,
      '80-100': 90,
    };
    let total = 0;
    let weight = 0;
    for (const row of buckets) {
      total += (mid[row.bucket] ?? 50) * row.count;
      weight += row.count;
    }
    return weight > 0 ? total / weight : 0;
  }, [charts.data?.byScore]);

  if (summary.isError) {
    return <Alert tone="error">{t('dashboard.loadError')}</Alert>;
  }

  const primaryRec = data?.recommendations?.[0];

  return (
    <DashboardFirstReveal
      active={reveal.active}
      origin={reveal.origin}
      durationMs={reveal.durationMs}
      onComplete={reveal.onRevealComplete}
    >
      <div className="space-y-6" key={i18n.language}>
      <PageHeader
        eyebrow={t('nav.groupOverview')}
        title={t('dashboard.title')}
        description={t('dashboard.subtitle')}
      />

      <DashboardWave delay={0}>
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
      </DashboardWave>

      <BentoGrid className="lg:auto-rows-fr">
        <BentoItem span={4}>
          <DashboardWave delay={0.05}>
            <ActionNextCard
              loading={loadingSummary}
              overdue={data?.overdueFollowUps[0] ?? null}
              opportunity={data?.topOpportunities[0] ?? null}
              recommendationHref={primaryRec?.href}
            />
          </DashboardWave>
        </BentoItem>

        <BentoItem span={3}>
          <DashboardWave delay={0.1}>
            <HeroKpiCard
              loading={loadingSummary}
              conversionRate={data?.conversionRate ?? 0}
              won={data?.won ?? 0}
              newLeads={data?.newLeads ?? 0}
              originRef={reveal.setOriginEl}
            />
          </DashboardWave>
        </BentoItem>

        <BentoItem span={5} className="lg:row-span-2">
          <DashboardWave delay={0.12}>
            <LeadsMapCard
              loading={loadingCharts}
              pins={charts.data?.mapPins ?? []}
              cities={charts.data?.byCity ?? []}
            />
          </DashboardWave>
        </BentoItem>

        <BentoItem span={4}>
          <DashboardWave delay={0.18}>
            <AccentBarChart loading={loadingCharts} data={charts.data?.byStatus ?? []} />
          </DashboardWave>
        </BentoItem>

        <BentoItem span={3}>
          <DashboardWave delay={0.22}>
            <GaugePair
              loading={loadingSummary}
              approachRate={data?.approachRate ?? 0}
              meetingRate={data?.meetingRate ?? 0}
            />
          </DashboardWave>
        </BentoItem>

        <BentoItem span={4}>
          <DashboardWave delay={0.28}>
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
          </DashboardWave>
        </BentoItem>

        <BentoItem span={4}>
          <DashboardWave delay={0.32}>
            <Card surface="bento" className="h-full">
              <CardHeader
                title={t('dashboard.topOpportunities')}
                description={t('dashboard.topOpportunitiesDesc')}
              />
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
                        <p className="truncate text-sm font-medium text-zinc-50">
                          {lead.companyName}
                        </p>
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
          </DashboardWave>
        </BentoItem>

        <BentoItem span={4}>
          <DashboardWave delay={0.36}>
            <PerformanceGauges
              loading={loadingSummary || loadingCharts}
              conversionRate={data?.conversionRate ?? 0}
              avgScore={avgScore}
            />
          </DashboardWave>
        </BentoItem>
      </BentoGrid>

      <DashboardWave delay={0.4}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={t('dashboard.totalLeads')}
            value={data?.totalLeads ?? 0}
            animateValue={loadingSummary ? undefined : (data?.totalLeads ?? 0)}
            hint={t('dashboard.newLeads')}
            icon={Users}
            loading={loadingSummary}
          />
          <MetricCard
            label={t('dashboard.newLeads')}
            value={data?.newLeads ?? 0}
            animateValue={loadingSummary ? undefined : (data?.newLeads ?? 0)}
            icon={UserPlus}
            loading={loadingSummary}
          />
          <MetricCard
            label={t('dashboard.won')}
            value={data?.won ?? 0}
            animateValue={loadingSummary ? undefined : (data?.won ?? 0)}
            icon={Handshake}
            loading={loadingSummary}
          />
          <MetricCard
            label={t('dashboard.overdueTasks')}
            value={data?.overdueTasks ?? 0}
            animateValue={loadingSummary ? undefined : (data?.overdueTasks ?? 0)}
            icon={AlertTriangle}
            loading={loadingSummary}
          />
        </div>
      </DashboardWave>

      <DashboardWave delay={0.45}>
        <details className="group rounded-panel border border-white/[0.08] bg-zinc-900/40 open:bg-zinc-900/60">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-300 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3">
              {t('dashboard.moreMetrics')}
              <Target className="h-4 w-4 text-zinc-500 transition group-open:rotate-90" aria-hidden />
            </span>
          </summary>
          <div className="grid grid-cols-1 gap-4 border-t border-white/[0.06] p-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={t('dashboard.meetings')}
              value={data?.meetings ?? 0}
              animateValue={loadingSummary ? undefined : (data?.meetings ?? 0)}
              icon={Users}
              loading={loadingSummary}
            />
            <MetricCard
              label={t('dashboard.proposals')}
              value={data?.proposals ?? 0}
              animateValue={loadingSummary ? undefined : (data?.proposals ?? 0)}
              icon={FileText}
              loading={loadingSummary}
            />
            <MetricCard
              label={t('dashboard.lost')}
              value={data?.lost ?? 0}
              animateValue={loadingSummary ? undefined : (data?.lost ?? 0)}
              icon={AlertTriangle}
              loading={loadingSummary}
            />
            <MetricCard
              label={t('dashboard.followUpRate')}
              value={`${data?.followUpRate ?? 0}%`}
              animateValue={loadingSummary ? undefined : (data?.followUpRate ?? 0)}
              animateSuffix="%"
              icon={Target}
              loading={loadingSummary}
            />
            <MetricCard
              label={t('dashboard.lossRate')}
              value={`${data?.lossRate ?? 0}%`}
              animateValue={loadingSummary ? undefined : (data?.lossRate ?? 0)}
              animateSuffix="%"
              icon={AlertTriangle}
              loading={loadingSummary}
            />
          </div>
        </details>
      </DashboardWave>

      <DashboardWave delay={0.5}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
      </DashboardWave>

      <DashboardWave delay={0.55}>
        <Card surface="bento">
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
                        <td className="px-3 py-2 tabular-nums text-zinc-300">
                          {row.conversionRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </DashboardWave>
      </div>
    </DashboardFirstReveal>
  );
}

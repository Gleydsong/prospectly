import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock3,
  Hand,
  KanbanSquare,
  List,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchDashboardSummary } from '@/features/dashboard/api';
import { useLeads } from '@/features/leads/hooks';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { LeadStatus } from '@/types';

function greetingKey(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

const STATUS_TABS: Array<{ key: string; status: LeadStatus | '' }> = [
  { key: 'all', status: '' },
  { key: 'new', status: LeadStatus.NEW },
  { key: 'contacted', status: LeadStatus.CONTACTED },
  { key: 'qualified', status: LeadStatus.QUALIFIED },
  { key: 'won', status: LeadStatus.WON },
];

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(/\s+/)[0] ?? '';
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [view, setView] = useState<'list' | 'kanban'>('list');

  const summary = useQuery({
    queryKey: ['dashboard', 'summary', { period: '30d' }],
    queryFn: () => fetchDashboardSummary({ period: '30d' }),
  });

  const leadsQuery = useLeads({
    page: 1,
    pageSize: 10,
    q: q.trim() || undefined,
    status: status || undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const data = summary.data;
  const leads = leadsQuery.data?.data ?? [];
  const meta = leadsQuery.data?.meta;

  const greeting = useMemo(() => {
    const key = greetingKey();
    return t(`principal.greeting.${key}`, { name: firstName });
  }, [firstName, i18n.language, t]);

  if (summary.isError) {
    return <Alert tone="error">{t('dashboard.loadError')}</Alert>;
  }

  return (
    <div className="space-y-6" key={i18n.language}>
      {/* Hero — Principal Facilitey */}
      <Card surface="default" className="overflow-hidden !border-white/[0.08]">
        <CardContent className="relative p-6 sm:p-8">
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_top_right,rgb(113_113_122_/_0.12),transparent_60%)]"
            aria-hidden
          />
          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-[color:var(--ink-muted)]">
                {greeting}
                <Hand className="h-4 w-4 text-amber-300" aria-hidden />
              </p>
              <h1 className="mt-2 max-w-[22ch] text-balance text-2xl font-bold tracking-tight text-[color:var(--ink)] sm:text-3xl">
                {t('principal.headline')}
              </h1>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
                <StatLine
                  icon={<Users className="h-4 w-4 text-zinc-300" />}
                  loading={summary.isLoading}
                  label={t((data?.newLeads ?? 0) === 1 ? 'principal.statNew_one' : 'principal.statNew_other', {
                    count: data?.newLeads ?? 0,
                  })}
                />
                <StatLine
                  icon={<CheckCircle2 className="h-4 w-4 text-sky-400" />}
                  loading={summary.isLoading}
                  label={t(
                    (data?.contacted ?? 0) === 1 ? 'principal.statContacted_one' : 'principal.statContacted_other',
                    { count: data?.contacted ?? 0 },
                  )}
                />
                <StatLine
                  icon={<Clock3 className="h-4 w-4 text-amber-400" />}
                  loading={summary.isLoading}
                  label={t(
                    (data?.overdueFollowUps?.length ?? data?.overdueTasks ?? 0) === 1
                      ? 'principal.statFollowUps_one'
                      : 'principal.statFollowUps_other',
                    { count: data?.overdueFollowUps?.length ?? data?.overdueTasks ?? 0 },
                  )}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <p className="max-w-xs text-sm leading-relaxed text-[color:var(--ink-muted)] lg:text-right">
                {t('principal.ctaHint')}
              </p>
              <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:flex-col">
                <Button
                  size="lg"
                  className="w-full sm:min-w-[220px]"
                  onClick={() => navigate('/search')}
                >
                  {t('principal.searchClients')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:min-w-[220px]"
                  onClick={() => navigate('/tasks')}
                >
                  <Clock3 className="h-4 w-4" aria-hidden />
                  {t('principal.viewFollowUps')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seus clientes */}
      <Card className="overflow-hidden">
        <div className="border-b border-white/[0.08] px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-zinc-50">
                {t('principal.clientsTitle')}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">{t('principal.clientsDesc')}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                aria-hidden
              />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder={t('principal.clientsSearch')}
                aria-label={t('principal.clientsSearch')}
                className="field-control h-11 w-full rounded-control pl-9 pr-3 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigate('/leads')}>
                {t('principal.filters')}
              </Button>
              <Button variant="outline" onClick={() => navigate('/imports')}>
                {t('principal.import')}
              </Button>
              <Button variant="outline" onClick={() => navigate('/leads')}>
                {t('principal.export')}
              </Button>
              <Button onClick={() => navigate('/leads')}>
                <UserPlus className="h-4 w-4" aria-hidden />
                {t('principal.newClient')}
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatus(tab.status)}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors',
                    status === tab.status
                      ? 'bg-zinc-800 text-zinc-50'
                      : 'border border-white/[0.08] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200',
                  )}
                >
                  {t(`principal.tab.${tab.key}`)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-control border border-white/[0.08] p-1">
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-sm font-medium',
                  view === 'list' ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400',
                )}
                onClick={() => setView('list')}
              >
                <List className="h-4 w-4" aria-hidden />
                {t('principal.viewList')}
              </button>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-sm font-medium',
                  view === 'kanban' ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400',
                )}
                onClick={() => {
                  setView('kanban');
                  navigate('/pipeline');
                }}
              >
                <KanbanSquare className="h-4 w-4" aria-hidden />
                {t('principal.viewKanban')}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-xs font-medium uppercase tracking-wide text-zinc-500">
                <th className="px-5 py-3 font-semibold sm:px-6">{t('principal.colClient')}</th>
                <th className="px-3 py-3 font-semibold">{t('principal.colCity')}</th>
                <th className="px-3 py-3 font-semibold">{t('principal.colStatus')}</th>
                <th className="px-3 py-3 font-semibold">{t('principal.colScore')}</th>
                <th className="px-5 py-3 font-semibold sm:px-6">{t('principal.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {leadsQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8">
                    <Skeleton className="h-24 w-full" />
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-sm text-zinc-500">
                    {t('principal.emptyClients')}
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-white/[0.06] transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-3.5 sm:px-6">
                      <Link
                        to={`/leads/${lead.id}`}
                        className="font-semibold text-[color:var(--ink)] hover:underline"
                      >
                        {lead.companyName}
                      </Link>
                    </td>
                    <td className="px-3 py-3.5 text-zinc-400">{lead.city ?? '—'}</td>
                    <td className="px-3 py-3.5">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td className="px-3 py-3.5 tabular-nums text-zinc-300">{lead.score ?? '—'}</td>
                    <td className="px-5 py-3.5 sm:px-6">
                      <Link
                        to={`/leads/${lead.id}`}
                        className="text-sm font-semibold text-zinc-300 hover:text-zinc-50"
                      >
                        {t('principal.open')}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-5 py-3 text-sm text-zinc-500 sm:px-6">
          <p>
            {t('principal.showing', {
              from: leads.length ? 1 : 0,
              to: leads.length,
              total: meta?.total ?? leads.length,
            })}
          </p>
          <Button variant="ghost" size="sm" onClick={() => navigate('/leads')}>
            {t('principal.seeAll')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function StatLine({
  icon,
  label,
  loading,
}: {
  icon: ReactNode;
  label: string;
  loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-5 w-48" />;
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--ink)]">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800/80">
        {icon}
      </span>
      {label}
    </div>
  );
}

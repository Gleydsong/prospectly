import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  Clock3,
  Hand,
  KanbanSquare,
  List,
  Mail,
  MapPin,
  Phone,
  Search,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LeadScore } from '@/components/ui/lead-score';
import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchDashboardSummary } from '@/features/dashboard/api';
import { useLeads } from '@/features/leads/hooks';
import { formatCategoryTag } from '@/features/opportunity-finder/format-category-tag';
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

function getCompanyInitials(name: string | undefined): string {
  if (!name) return 'CO';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  const second = parts[1];
  if (!first) return 'CO';
  if (!second) {
    return first.slice(0, 2).toUpperCase();
  }
  return ((first[0] ?? '') + (second[0] ?? '')).toUpperCase() || 'CO';
}

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
  }, [firstName, t]);

  const followUpsCount = data?.overdueFollowUps?.length ?? data?.overdueTasks ?? 0;
  const dailyContactGoal = 10;
  const contactedCount = data?.contacted ?? 0;
  const dailyProgressPercent = Math.min(100, Math.round((contactedCount / dailyContactGoal) * 100));

  if (summary.isError) {
    return <Alert tone="error">{t('dashboard.loadError')}</Alert>;
  }

  return (
    <div className="space-y-6" key={i18n.language}>
      {/* 2. Banner de Atenção ("Aqui está o que precisa da sua atenção hoje") */}
      <Card surface="default" className="overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--ink-secondary)]">
                <span>{greeting}</span>
                <Hand
                  className="h-4 w-4 shrink-0 text-[color:var(--status-warning-ink)]"
                  aria-hidden="true"
                />
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--ink)] sm:text-2xl">
                {t('principal.headline')}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
              <Button variant="outline" size="md" onClick={() => navigate('/tasks')}>
                <Clock3 className="h-4 w-4 text-[color:var(--ink-muted)]" aria-hidden="true" />
                <span>{t('principal.viewFollowUps')}</span>
              </Button>
              <Button size="md" onClick={() => navigate('/search')}>
                <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {t('principal.prospectLeads', { defaultValue: 'Prospectar Novos Leads' })}
                </span>
              </Button>
            </div>
          </div>

          {/* Grid Horizontal Responsivo com 3 Cards de KPIs / Métricas */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1: Novos para Analisar */}
            <div className="flex flex-col justify-between rounded-card border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-[color:var(--ink-secondary)]">
                    {t('principal.newToReview', { defaultValue: 'Novos para Analisar' })}
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold tracking-tight text-[color:var(--ink)] tabular-nums">
                      {summary.isLoading ? '...' : (data?.newLeads ?? 0)}
                    </span>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-[color:var(--status-danger-bg)] px-2.5 py-0.5 text-xs font-semibold text-[color:var(--status-danger-ink)]">
                  {t('principal.highPriority', { defaultValue: 'Prioridade Alta' })}
                </span>
              </div>
              <div className="mt-4 border-t border-[color:var(--border-default)] pt-3">
                <button
                  type="button"
                  onClick={() => setStatus(LeadStatus.NEW)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--brand)] hover:text-[color:var(--brand-hover)]"
                >
                  <span>{t('principal.filterNew', { defaultValue: 'Filtrar novos' })}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Card 2: Contatados Hoje */}
            <div className="flex flex-col justify-between rounded-card border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-semibold text-[color:var(--ink-secondary)]">
                    {t('principal.contactedToday', { defaultValue: 'Contatados Hoje' })}
                  </span>
                  <span className="text-xs font-medium text-[color:var(--ink-secondary)]">
                    {t('principal.dailyGoal', { defaultValue: 'Meta: 10/dia' })}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tracking-tight text-[color:var(--ink)] tabular-nums">
                    {summary.isLoading ? '...' : contactedCount}
                  </span>
                  <span className="text-sm font-medium text-[color:var(--ink-secondary)]">
                    {t('principal.goalOf', {
                      current: '',
                      goal: dailyContactGoal,
                      defaultValue: `de ${dailyContactGoal}`,
                    })}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--bg-subtle)]"
                  role="progressbar"
                  aria-valuenow={dailyProgressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Meta diária de contatados"
                >
                  <div
                    className="h-full rounded-full bg-[color:var(--brand)] transition-all duration-500"
                    style={{ width: `${dailyProgressPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] font-medium text-[color:var(--ink-secondary)]">
                  {t('principal.dailyGoalProgress', {
                    percent: dailyProgressPercent,
                    defaultValue: `${dailyProgressPercent}% da meta diária atingida`,
                  })}
                </p>
              </div>
            </div>

            {/* Card 3: Acompanhamentos */}
            <div className="flex flex-col justify-between rounded-card border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-4 sm:col-span-2 lg:col-span-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-[color:var(--ink-secondary)]">
                    {t('principal.followUpsTitle', { defaultValue: 'Acompanhamentos' })}
                  </span>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-3xl font-semibold tracking-tight text-[color:var(--ink)] tabular-nums">
                      {summary.isLoading ? '...' : followUpsCount}
                    </span>
                    <span className="text-xs font-medium text-[color:var(--ink-secondary)]">
                      {t('principal.pendingCount', { count: '', defaultValue: 'pendentes' })}
                    </span>
                  </div>
                </div>
                {followUpsCount === 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--status-success-bg)] px-2.5 py-0.5 text-xs font-semibold text-[color:var(--status-success-ink)]">
                    <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {t('principal.upToDate', { defaultValue: 'Em dia ✓' })}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-[color:var(--status-warning-bg)] px-2.5 py-0.5 text-xs font-semibold text-[color:var(--status-warning-ink)]">
                    {t('principal.attentionNeeded', { defaultValue: 'Atenção necessária' })}
                  </span>
                )}
              </div>
              <div className="mt-4 border-t border-[color:var(--border-default)] pt-3">
                <button
                  type="button"
                  onClick={() => navigate('/tasks')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--brand)] hover:text-[color:var(--brand-hover)]"
                >
                  <span>{t('principal.viewPending', { defaultValue: 'Ver pendências' })}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Seus clientes & Barra de Ferramentas */}
      <Card className="overflow-hidden">
        <div className="border-b border-[color:var(--border-default)] px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ink)]">
                {t('principal.clientsTitle')}
              </h2>
              <p className="mt-1 text-sm text-[color:var(--ink-secondary)]">
                {t('principal.clientsDesc')}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs md:max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-muted)]"
                aria-hidden="true"
              />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder={t('principal.clientsSearch')}
                aria-label={t('principal.clientsSearch')}
                className="field-control h-11 w-full rounded-control pl-9 pr-3 text-sm placeholder:text-[color:var(--ink-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/leads')}>
                {t('principal.filters')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/imports')}>
                {t('principal.import')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/leads')}>
                {t('principal.export')}
              </Button>
              <Button size="sm" onClick={() => navigate('/leads')}>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                <span>{t('principal.newClient')}</span>
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {STATUS_TABS.map((tab) => {
                let count = 0;
                if (tab.key === 'all') {
                  count = data?.totalLeads ?? meta?.total ?? leads.length;
                } else if (tab.key === 'new') {
                  count = data?.newLeads ?? 0;
                } else if (tab.key === 'contacted') {
                  count = data?.contacted ?? 0;
                } else if (tab.key === 'qualified') {
                  count = data?.qualified ?? 0;
                } else if (tab.key === 'won') {
                  count = data?.won ?? 0;
                }

                const isSelected = status === tab.status;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatus(tab.status)}
                    className={cn(
                      'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                      isSelected
                        ? 'bg-[color:var(--brand)] text-[color:var(--brand-on)]'
                        : 'border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--ink)]',
                    )}
                  >
                    <span>{t(`principal.tab.${tab.key}`)}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
                        isSelected
                          ? 'bg-white/20 text-[color:var(--brand-on)]'
                          : 'bg-[color:var(--bg-subtle)] text-[color:var(--ink-secondary)]',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="inline-flex items-center self-start rounded-control border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] p-1 sm:self-auto">
              <button
                type="button"
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-[8px] px-2.5 text-xs font-semibold transition-colors',
                  view === 'list'
                    ? 'bg-[color:var(--bg-surface)] text-[color:var(--ink)] shadow-panel'
                    : 'text-[color:var(--ink-secondary)] hover:text-[color:var(--ink)]',
                )}
                onClick={() => setView('list')}
              >
                <List className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('principal.viewList')}</span>
              </button>
              <button
                type="button"
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-[8px] px-2.5 text-xs font-semibold transition-colors',
                  view === 'kanban'
                    ? 'bg-[color:var(--bg-surface)] text-[color:var(--ink)] shadow-panel'
                    : 'text-[color:var(--ink-secondary)] hover:text-[color:var(--ink)]',
                )}
                onClick={() => {
                  setView('kanban');
                  navigate('/pipeline');
                }}
              >
                <KanbanSquare className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('principal.viewKanban')}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="app-table w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border-default)] text-xs font-medium text-[color:var(--ink-secondary)]">
                <th className="px-5 py-3 font-semibold sm:px-6">{t('principal.colClient')}</th>
                <th className="px-3 py-3 font-semibold">{t('principal.colCity')}</th>
                <th className="px-3 py-3 font-semibold">{t('principal.colStatus')}</th>
                <th className="px-3 py-3 font-semibold">{t('principal.colScore')}</th>
                <th className="px-5 py-3 font-semibold text-right sm:px-6 sm:text-left">
                  {t('principal.colActions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-default)]">
              {leadsQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8">
                    <Skeleton className="h-24 w-full" />
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-16 text-center text-sm text-[color:var(--ink-secondary)]"
                  >
                    {t('principal.emptyClients')}
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const companyInitials = getCompanyInitials(lead.companyName);
                  const rawNiche = lead.segment || lead.category || lead.tradeName || 'Geral';
                  const nicheOrSegment = formatCategoryTag(rawNiche);

                  return (
                    <tr
                      key={lead.id}
                      className="group transition-colors hover:bg-[color:var(--surface-hover)]"
                    >
                      <td className="px-5 py-3.5 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-[color:var(--brand-soft)] text-xs font-bold text-[color:var(--brand-hover)]"
                            aria-hidden="true"
                          >
                            {companyInitials}
                          </div>
                          <div className="min-w-0">
                            <Link
                              to={`/leads/${lead.id}`}
                              className="block truncate font-semibold text-[color:var(--ink)] hover:text-[color:var(--brand)]"
                            >
                              {lead.companyName}
                            </Link>
                            <p className="truncate text-xs text-[color:var(--ink-secondary)]">
                              {nicheOrSegment}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        <div className="inline-flex items-center gap-1.5 text-xs text-[color:var(--ink-secondary)]">
                          <MapPin
                            className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-muted)]"
                            aria-hidden="true"
                          />
                          <span className="truncate">{lead.city ?? '—'}</span>
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        <LeadStatusBadge status={lead.status} />
                      </td>

                      <td className="px-3 py-3.5">
                        <LeadScore score={lead.score} />
                      </td>

                      <td className="px-5 py-3.5 sm:px-6">
                        <div className="flex items-center justify-end gap-1.5 sm:justify-start">
                          <div className="flex items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                            {lead.email ? (
                              <a
                                href={`mailto:${lead.email}`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] text-[color:var(--ink-secondary)] hover:bg-[color:var(--brand-soft)] hover:text-[color:var(--brand)]"
                                title={`Enviar e-mail para ${lead.email}`}
                                aria-label={`Enviar e-mail para ${lead.email}`}
                              >
                                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                              </a>
                            ) : null}
                            {lead.phone ? (
                              <a
                                href={`tel:${lead.phone}`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] text-[color:var(--ink-secondary)] hover:bg-[color:var(--status-success-bg)] hover:text-[color:var(--status-success-ink)]"
                                title={`Ligar para ${lead.phone}`}
                                aria-label={`Ligar para ${lead.phone}`}
                              >
                                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                              </a>
                            ) : null}
                          </div>

                          <Link
                            to={`/leads/${lead.id}`}
                            className="inline-flex items-center justify-center rounded-control border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink)] hover:bg-[color:var(--bg-subtle)]"
                          >
                            {t('principal.open')}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border-default)] px-5 py-3 text-sm text-[color:var(--ink-secondary)] sm:px-6">
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

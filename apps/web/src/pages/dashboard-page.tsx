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
      <Card
        surface="default"
        className="overflow-hidden border border-slate-200/80 dark:border-white/[0.08] shadow-xs"
      >
        <CardContent className="p-6 sm:p-7">
          {/* Header do Banner: Saudação, Título e CTAs Comerciais */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <span>{greeting}</span>
                <Hand
                  className="h-4 w-4 text-amber-400 animate-wiggle shrink-0"
                  aria-hidden="true"
                />
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
                {t('principal.headline')}
              </h1>
            </div>

            {/* CTAs Comerciais */}
            <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
              <Button
                variant="outline"
                size="md"
                className="inline-flex items-center gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => navigate('/tasks')}
              >
                <Clock3 className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <span>{t('principal.viewFollowUps')}</span>
              </Button>
              <Button
                size="md"
                className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                onClick={() => navigate('/search')}
              >
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
            <div className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-white/[0.08] dark:bg-zinc-900/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    {t('principal.newToReview', { defaultValue: 'Novos para Analisar' })}
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
                      {summary.isLoading ? '...' : (data?.newLeads ?? 0)}
                    </span>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {t('principal.highPriority', { defaultValue: 'Prioridade Alta' })}
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setStatus(LeadStatus.NEW)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  <span>{t('principal.filterNew', { defaultValue: 'Filtrar novos' })}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Card 2: Contatados Hoje */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-white/[0.08] dark:bg-zinc-900/60">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    {t('principal.contactedToday', { defaultValue: 'Contatados Hoje' })}
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                    {t('principal.dailyGoal', { defaultValue: 'Meta: 10/dia' })}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
                    {summary.isLoading ? '...' : contactedCount}
                  </span>
                  <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">
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
                  className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={dailyProgressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Meta diária de contatados"
                >
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all duration-500"
                    style={{ width: `${dailyProgressPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                  {t('principal.dailyGoalProgress', {
                    percent: dailyProgressPercent,
                    defaultValue: `${dailyProgressPercent}% da meta diária atingida`,
                  })}
                </p>
              </div>
            </div>

            {/* Card 3: Acompanhamentos */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-white/[0.08] dark:bg-zinc-900/60 sm:col-span-2 lg:col-span-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    {t('principal.followUpsTitle', { defaultValue: 'Acompanhamentos' })}
                  </span>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
                      {summary.isLoading ? '...' : followUpsCount}
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                      {t('principal.pendingCount', { count: '', defaultValue: 'pendentes' })}
                    </span>
                  </div>
                </div>
                {followUpsCount === 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {t('principal.upToDate', { defaultValue: 'Em dia ✓' })}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                    {t('principal.attentionNeeded', { defaultValue: 'Atenção necessária' })}
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => navigate('/tasks')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
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
      <Card className="overflow-hidden border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
        <div className="border-b border-slate-200/80 dark:border-white/[0.08] px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {t('principal.clientsTitle')}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                {t('principal.clientsDesc')}
              </p>
            </div>
          </div>

          {/* Barra de Busca Local (limitada em max-w-sm) e Botões de Ação */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs md:max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder={t('principal.clientsSearch')}
                aria-label={t('principal.clientsSearch')}
                className="field-control h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => navigate('/leads')}
              >
                {t('principal.filters')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => navigate('/imports')}
              >
                {t('principal.import')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => navigate('/leads')}
              >
                {t('principal.export')}
              </Button>
              <Button
                size="sm"
                className="h-10 bg-slate-900 text-white shadow-sm hover:bg-slate-800 active:bg-slate-950 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-semibold px-4"
                onClick={() => navigate('/leads')}
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                <span>{t('principal.newClient')}</span>
              </Button>
            </div>
          </div>

          {/* Pílulas de Status Integradas com Contadores Dinâmicos & Seletor de Visualização */}
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
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                      isSelected
                        ? 'bg-slate-900 text-white shadow-2xs dark:bg-white dark:text-slate-900'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white',
                    )}
                  >
                    <span>{t(`principal.tab.${tab.key}`)}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-semibold',
                        isSelected
                          ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Seletor de visualização (Lista vs Kanban) alinhado */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/80 self-start sm:self-auto">
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                  view === 'list'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                )}
                onClick={() => setView('list')}
              >
                <List className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('principal.viewList')}</span>
              </button>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                  view === 'kanban'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
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

        {/* 6. Tabela de Clientes com Avatar, Segmento, MapPin, LeadScore e Ações Rápidas */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-white/[0.08] dark:text-zinc-400">
                <th className="px-5 py-3 font-semibold sm:px-6">{t('principal.colClient')}</th>
                <th className="px-3 py-3 font-semibold">{t('principal.colCity')}</th>
                <th className="px-3 py-3 font-semibold">{t('principal.colStatus')}</th>
                <th className="px-3 py-3 font-semibold">{t('principal.colScore')}</th>
                <th className="px-5 py-3 font-semibold text-right sm:px-6 sm:text-left">
                  {t('principal.colActions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
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
                    className="px-6 py-16 text-center text-sm text-slate-500 dark:text-zinc-400"
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
                      className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.02]"
                    >
                      {/* Cliente: Avatar + Iniciais + Nome + Segmento/Nicho */}
                      <td className="px-5 py-3.5 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-xs font-bold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/60 dark:text-blue-300"
                            aria-hidden="true"
                          >
                            {companyInitials}
                          </div>
                          <div className="min-w-0">
                            <Link
                              to={`/leads/${lead.id}`}
                              className="block truncate font-semibold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400 transition-colors"
                            >
                              {lead.companyName}
                            </Link>
                            <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
                              {nicheOrSegment}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Localização: Cidade com Ícone MapPin */}
                      <td className="px-3 py-3.5">
                        <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400">
                          <MapPin
                            className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="truncate">{lead.city ?? '—'}</span>
                        </div>
                      </td>

                      {/* Status: Semântica Estrita de Cores */}
                      <td className="px-3 py-3.5">
                        <LeadStatusBadge status={lead.status} />
                      </td>

                      {/* Pontuação (Lead Score Contextualizada) */}
                      <td className="px-3 py-3.5">
                        <LeadScore score={lead.score} />
                      </td>

                      {/* Ações Rápidas: Botão Abrir com feedback de hover + atalhos Mail/Phone */}
                      <td className="px-5 py-3.5 sm:px-6">
                        <div className="flex items-center justify-end gap-1.5 sm:justify-start">
                          {/* Atalhos de produtividade ao passar o mouse */}
                          <div className="flex items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                            {lead.email ? (
                              <a
                                href={`mailto:${lead.email}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-blue-950 dark:hover:text-blue-300 transition-colors"
                                title={`Enviar e-mail para ${lead.email}`}
                                aria-label={`Enviar e-mail para ${lead.email}`}
                              >
                                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                              </a>
                            ) : null}
                            {lead.phone ? (
                              <a
                                href={`tel:${lead.phone}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-emerald-950 dark:hover:text-emerald-300 transition-colors"
                                title={`Ligar para ${lead.phone}`}
                                aria-label={`Ligar para ${lead.phone}`}
                              >
                                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                              </a>
                            ) : null}
                          </div>

                          <Link
                            to={`/leads/${lead.id}`}
                            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white transition-colors"
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

        {/* Rodapé da Tabela */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 px-5 py-3 text-sm text-slate-500 dark:border-white/[0.08] dark:text-zinc-400 sm:px-6">
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

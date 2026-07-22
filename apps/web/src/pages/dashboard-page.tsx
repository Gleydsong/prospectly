import { useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  FileText,
  Handshake,
  Target,
  UserPlus,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchDashboardCharts, fetchDashboardSummary } from '@/features/dashboard/api';
import { formatDate } from '@/lib/utils';

const PIE_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#f97316', '#8b5cf6', '#d946ef', '#ec4899'];

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
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50">
          <Icon className="h-5 w-5 text-brand-600" aria-hidden />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const summary = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: fetchDashboardSummary });
  const charts = useQuery({ queryKey: ['dashboard', 'charts'], queryFn: fetchDashboardCharts });

  if (summary.isError) {
    return (
      <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
        Erro ao carregar o dashboard. Tente novamente.
      </p>
    );
  }

  const data = summary.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Visão geral das suas oportunidades</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summary.isLoading || !data ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-20" />)
        ) : (
          <>
            <StatCard label="Total de leads" value={data.totalLeads} icon={Users} />
            <StatCard label="Novos (30 dias)" value={data.newLeads} icon={UserPlus} />
            <StatCard label="Reuniões marcadas" value={data.meetings} icon={CalendarClock} />
            <StatCard label="Propostas enviadas" value={data.proposals} icon={FileText} />
            <StatCard label="Clientes ganhos" value={data.won} icon={Handshake} />
            <StatCard label="Taxa de conversão" value={`${data.conversionRate}%`} icon={Target} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Leads por status" />
          <CardContent className="h-72">
            {charts.isLoading || !charts.data ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.data.byStatus}>
                  <XAxis dataKey="status" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Distribuição por score" />
          <CardContent className="h-72">
            {charts.isLoading || !charts.data ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.data.byScore}
                    dataKey="count"
                    nameKey="bucket"
                    innerRadius={55}
                    outerRadius={90}
                    label={({ bucket, count }) => `${bucket}: ${count}`}
                  >
                    {charts.data.byScore.map((entry, index) => (
                      <Cell key={entry.bucket} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Principais oportunidades" description="Leads com maior score" />
          <CardContent className="space-y-3">
            {!data || data.topOpportunities.length === 0 ? (
              <p className="text-sm text-slate-500">Sem leads ainda.</p>
            ) : (
              data.topOpportunities.map((lead) => (
                <Link
                  key={lead.id}
                  to={`/leads/${lead.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{lead.companyName}</p>
                    <p className="text-xs text-slate-500">{lead.city ?? '—'}</p>
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
          <CardHeader title="Próximos acompanhamentos" />
          <CardContent className="space-y-3">
            {!data || data.upcomingFollowUps.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum acompanhamento agendado.</p>
            ) : (
              data.upcomingFollowUps.map((item) => (
                <Link
                  key={item.id}
                  to={`/leads/${item.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-slate-900">{item.companyName}</span>
                  <span className="text-xs text-slate-500">{formatDate(item.nextContactAt)}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ScoreBadge } from '@/components/ui/score-badge';
import { getLeadStatusLabel } from '@/lib/lead-status';
import { LeadStatus } from '@/types';
import { fetchLeads, type LeadsQuery } from '../api';

function ClientStatusColumn({ status, filters }: { status: LeadStatus; filters: LeadsQuery }) {
  const { t } = useTranslation();
  const matchesStatus = !filters.status || filters.status === status;
  const query = useInfiniteQuery({
    queryKey: ['leads', 'board', status, filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchLeads({ ...filters, status, page: pageParam, pageSize: 20 }),
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled: matchesStatus,
  });
  const clients = query.data?.pages.flatMap((page) => page.data) ?? [];
  const total = matchesStatus ? query.data?.pages[0]?.meta.total : undefined;
  return (
    <section
      role="listitem"
      className="kanban-col border-t-4 bg-[color:var(--bg-subtle)]"
      style={{ borderTopColor: `var(--lead-status-${status}-pin)` }}
      aria-label={getLeadStatusLabel(status)}
    >
      <header className="kanban-col__header">
        <h2 className="min-w-0 text-sm font-semibold">{getLeadStatusLabel(status)}</h2>
        <span className="shrink-0 rounded-full bg-black/10 px-2 py-0.5 text-xs font-semibold tabular-nums">
          {total ?? '—'}
        </span>
      </header>
      <ul className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto p-2">
        {clients.map((client) => (
          <li key={client.id}>
            <Link
              to={`/clientes/${client.id}`}
              className="block rounded-card border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-3 hover:bg-[color:var(--surface-hover)]"
            >
              <p className="font-medium text-[color:var(--ink)]">{client.companyName}</p>
              <p className="my-2 text-xs text-[color:var(--ink-secondary)]">{client.city ?? '—'}</p>
              <ScoreBadge score={client.score} />
            </Link>
          </li>
        ))}
      </ul>
      {query.isError ? (
        <p role="alert" className="px-3 text-sm">
          {t('common.errorGeneric')}
        </p>
      ) : null}
      {query.hasNextPage || query.isError ? (
        <Button
          variant="outline"
          className="m-2"
          loading={query.isFetching}
          onClick={() => void (query.isError ? query.refetch() : query.fetchNextPage())}
        >
          {t(query.isError ? 'common.retry' : 'clientsViews.loadMore')}
        </Button>
      ) : null}
    </section>
  );
}

export function LeadsKanban({ filters, label }: { filters: LeadsQuery; label: string }) {
  return (
    <div className="p-4">
      <div role="list" aria-label={label} className="flex gap-3 overflow-x-auto pb-4">
        {Object.values(LeadStatus).map((status) => (
          <ClientStatusColumn key={status} status={status} filters={filters} />
        ))}
      </div>
    </div>
  );
}

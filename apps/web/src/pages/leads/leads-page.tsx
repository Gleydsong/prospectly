import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Globe, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { Pagination } from '@/components/ui/pagination';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useLeads } from '@/features/leads/hooks';
import { LeadStatus } from '@/types';

import { LeadFormModal } from './lead-form-modal';

export function LeadsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [hasWebsite, setHasWebsite] = useState<'' | 'yes' | 'no'>('');
  const [modalOpen, setModalOpen] = useState(false);

  const query = useLeads({
    page,
    pageSize: 15,
    q: search || undefined,
    status: status || undefined,
    hasWebsite: hasWebsite === '' ? undefined : hasWebsite === 'yes',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const leads = query.data?.data ?? [];
  const meta = query.data?.meta;

  const applySearch = () => {
    setPage(1);
    setSearch(q.trim());
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Leads</h1>
          <p className="text-sm text-zinc-500">Gerencie e qualifique suas oportunidades</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Novo lead
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px_170px_auto]">
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por nome, e-mail ou domínio…"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applySearch();
              }}
              aria-label="Buscar leads"
            />
          </div>
          <Select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as LeadStatus | '');
            }}
            aria-label="Filtrar por status"
          >
            <option value="">Todos os status</option>
            {Object.values(LeadStatus).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <Select
            value={hasWebsite}
            onChange={(event) => {
              setPage(1);
              setHasWebsite(event.target.value as '' | 'yes' | 'no');
            }}
            aria-label="Filtrar por website"
          >
            <option value="">Com/sem site</option>
            <option value="yes">Com site</option>
            <option value="no">Sem site</option>
          </Select>
          <Button variant="secondary" onClick={applySearch}>
            Buscar
          </Button>
        </div>
      </Card>

      {query.isLoading ? (
        <Card className="p-5">
          <TableSkeleton rows={8} columns={5} />
        </Card>
      ) : query.isError ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
          Erro ao carregar leads. Tente novamente.
        </p>
      ) : leads.length === 0 ? (
        <EmptyState
          title="Nenhum lead encontrado"
          description="Ajuste os filtros ou crie o primeiro lead manualmente."
          action={
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Novo lead
            </Button>
          }
        />
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                  <th scope="col" className="px-5 py-3 font-medium">Empresa</th>
                  <th scope="col" className="px-5 py-3 font-medium">Cidade</th>
                  <th scope="col" className="px-5 py-3 font-medium">Status</th>
                  <th scope="col" className="px-5 py-3 font-medium">Score</th>
                  <th scope="col" className="px-5 py-3 font-medium">Responsável</th>
                  <th scope="col" className="px-5 py-3 font-medium">Tags</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="cursor-pointer border-b border-zinc-50 hover:bg-zinc-50"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <Link
                            to={`/leads/${lead.id}`}
                            className="font-medium text-zinc-900 hover:text-brand-600"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {lead.companyName}
                          </Link>
                          <p className="text-xs text-zinc-500">{lead.segment ?? lead.category ?? '—'}</p>
                        </div>
                        {!lead.website ? (
                          <Badge tone="amber" title="Sem website">
                            <Globe className="h-3 w-3" aria-hidden /> sem site
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-zinc-600">{lead.city ?? '—'}</td>
                    <td className="px-5 py-3">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td className="px-5 py-3">
                      <ScoreBadge score={lead.score} />
                    </td>
                    <td className="px-5 py-3 text-zinc-600">{lead.owner?.name ?? '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {lead.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag.id}>{tag.name}</Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {meta ? (
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
          ) : null}
        </>
      )}

      <LeadFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

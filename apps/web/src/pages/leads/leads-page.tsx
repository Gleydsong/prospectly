import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Globe, Plus, Trash2 } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORTABLE_LEAD_COLUMNS,
  type ExportableLeadColumn,
  downloadCsvFile,
  exportLeadsCsv,
} from '@/features/leads/api';
import { getApiErrorMessage } from '@/lib/api';
import { getLeadStatusLabel } from '@/lib/lead-status';
import { useDeleteLead, useLeads } from '@/features/leads/hooks';
import { LeadStatus } from '@/types';

import { LeadFormModal } from './lead-form-modal';

export function LeadsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQ = (searchParams.get('q') ?? '').trim();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState(initialQ);
  const [search, setSearch] = useState(initialQ);
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [hasWebsite, setHasWebsite] = useState<'' | 'yes' | 'no'>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportColumns, setExportColumns] = useState<ExportableLeadColumn[]>([...DEFAULT_EXPORT_COLUMNS]);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const deleteLead = useDeleteLead();

  useEffect(() => {
    const urlQ = (searchParams.get('q') ?? '').trim();
    setQ(urlQ);
    setSearch(urlQ);
    setPage(1);
  }, [searchParams]);

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
    const term = q.trim();
    setPage(1);
    setSearch(term);
    navigate(term ? `/leads?q=${encodeURIComponent(term)}` : '/leads', { replace: true });
  };

  const toggleExportColumn = (column: ExportableLeadColumn) => {
    setExportColumns((current) =>
      current.includes(column) ? current.filter((value) => value !== column) : [...current, column],
    );
  };

  const runExport = async () => {
    if (!exportColumns.length) return;
    setExporting(true);
    setExportMessage(null);
    setActionError(null);
    try {
      const result = await exportLeadsCsv({
        columns: exportColumns,
        q: search || undefined,
        status: status || undefined,
        hasWebsite: hasWebsite === '' ? undefined : hasWebsite === 'yes',
      });
      downloadCsvFile(result.filename, result.csv);
      setExportMessage(t('leads.exportSuccess', { count: result.rowCount }));
      setExportOpen(false);
    } catch (error) {
      setActionError(getApiErrorMessage(error) || t('leads.exportError'));
    } finally {
      setExporting(false);
    }
  };

  const removeLead = async (leadId: string, companyName: string) => {
    const confirmed = window.confirm(
      `Apagar o lead "${companyName}"? Ele será removido da lista.`,
    );
    if (!confirmed) return;
    setActionError(null);
    try {
      await deleteLead.mutateAsync(leadId);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('nav.clientes')}
        title={t('leads.title')}
        description={t('principal.clientsDesc')}
        actions={
          <>
            <Button variant="outline" onClick={() => setExportOpen(true)}>
              <Download className="h-4 w-4" aria-hidden />
              {t('leads.export')}
            </Button>
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              {t('principal.newClient')}
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="space-y-4 border-b border-white/[0.08] p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px_170px_auto]">
          <div className="flex gap-2">
            <Input
              placeholder={t('principal.clientsSearch')}
              value={q}
              onChange={(event) => setQ(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applySearch();
              }}
              aria-label={t('nav.searchClients')}
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
                {getLeadStatusLabel(value)}
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
          <Button variant="outline" onClick={applySearch}>
            Buscar
          </Button>
        </div>
        </div>

      {exportMessage ? <Alert tone="success">{exportMessage}</Alert> : null}

      {query.isLoading ? (
        <div className="p-5">
          <TableSkeleton rows={8} columns={5} />
        </div>
      ) : query.isError ? (
        <div className="p-5">
          <Alert tone="error">Erro ao carregar leads. Tente novamente.</Alert>
        </div>
      ) : leads.length === 0 ? (
        <div className="p-5">
        <EmptyState
          title="Nenhum lead encontrado"
          description="Ajuste os filtros ou crie o primeiro lead manualmente."
          action={
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              {t('principal.newClient')}
            </Button>
          }
        />
        </div>
      ) : (
        <>
          {actionError ? (
            <div className="px-5 pt-4">
              <Alert tone="error">{actionError}</Alert>
            </div>
          ) : null}
            <ul className="divide-y divide-zinc-800 md:hidden">
              {leads.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-2 px-4 py-3.5 text-left hover:bg-zinc-950/80"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-50">{lead.companyName}</p>
                        <p className="text-xs text-zinc-500">
                          {[lead.city, lead.segment ?? lead.category].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <ScoreBadge score={lead.score} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <LeadStatusBadge status={lead.status} />
                      {!lead.website ? (
                        <Badge tone="amber" title="Sem website">
                          <Globe className="h-3 w-3" aria-hidden /> sem site
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <th scope="col" className="px-5 py-3 font-medium">Empresa</th>
                  <th scope="col" className="px-5 py-3 font-medium">Cidade</th>
                  <th scope="col" className="px-5 py-3 font-medium">Status</th>
                  <th scope="col" className="px-5 py-3 font-medium">Score</th>
                  <th scope="col" className="px-5 py-3 font-medium">Responsável</th>
                  <th scope="col" className="px-5 py-3 font-medium">Tags</th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="cursor-pointer border-b border-zinc-800 hover:bg-zinc-950"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <Link
                            to={`/leads/${lead.id}`}
                            className="font-medium text-zinc-50 hover:text-brand-400"
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
                    <td className="px-5 py-3 text-zinc-300">{lead.city ?? '—'}</td>
                    <td className="px-5 py-3">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td className="px-5 py-3">
                      <ScoreBadge score={lead.score} />
                    </td>
                    <td className="px-5 py-3 text-zinc-300">{lead.owner?.name ?? '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {lead.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag.id}>{tag.name}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        aria-label={`Apagar lead ${lead.companyName}`}
                        loading={deleteLead.isPending && deleteLead.variables === lead.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeLead(lead.id, lead.companyName);
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          {meta ? (
            <div className="border-t border-white/[0.08] px-4 py-3">
              <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
            </div>
          ) : null}
        </>
      )}
      </Card>

      <LeadFormModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title={t('leads.exportTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">{t('leads.exportColumns')}</p>
          <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-zinc-800 p-3">
            {EXPORTABLE_LEAD_COLUMNS.map((column) => (
              <label key={column} className="flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-700 text-brand-400 focus:ring-brand-400"
                  checked={exportColumns.includes(column)}
                  onChange={() => toggleExportColumn(column)}
                />
                <span>{column}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            Os filtros atuais (busca, status, website) serão aplicados à exportação.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setExportOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              loading={exporting}
              disabled={!exportColumns.length}
              onClick={() => void runExport()}
            >
              {t('leads.export')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

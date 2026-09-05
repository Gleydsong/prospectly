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
import { formatCategoryTag } from '@/features/opportunity-finder/format-category-tag';
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
  type LeadsQuery,
  downloadCsvFile,
  exportLeadsCsv,
} from '@/features/leads/api';
import { getApiErrorMessage } from '@/lib/api';
import { getLeadStatusLabel } from '@/lib/lead-status';
import { useBillingStatus } from '@/features/billing/hooks';
import { useDeleteLead, useLeads } from '@/features/leads/hooks';
import {
  useArchiveSavedView,
  useCreateSavedView,
  usePreviewSavedView,
  useSavedView,
  useSavedViews,
} from '@/features/saved-views/hooks';
import type { LeadViewDefinition, SavedViewVisibility } from '@/features/saved-views/api';
import { useAuthStore } from '@/stores/auth.store';
import { LeadStatus, Role } from '@/types';

import { LeadFormModal } from './lead-form-modal';

function definitionFromFilters(input: {
  q: string;
  status: LeadStatus | '';
  hasWebsite: '' | 'yes' | 'no';
  extras: LeadViewDefinition;
}): LeadViewDefinition {
  return {
    ...input.extras,
    ...(input.q.trim() ? { q: input.q.trim() } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.hasWebsite === '' ? {} : { hasWebsite: input.hasWebsite === 'yes' }),
  };
}

export function LeadsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [searchParams] = useSearchParams();
  const initialQ = (searchParams.get('q') ?? '').trim();
  const viewId = (searchParams.get('view') ?? '').trim();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState(initialQ);
  const [search, setSearch] = useState(initialQ);
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [hasWebsite, setHasWebsite] = useState<'' | 'yes' | 'no'>('');
  const [extras, setExtras] = useState<LeadViewDefinition>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [viewVisibility, setViewVisibility] = useState<SavedViewVisibility>('PRIVATE');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportColumns, setExportColumns] = useState<ExportableLeadColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ]);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const deleteLead = useDeleteLead();
  const billing = useBillingStatus();
  const canExportCsv = Boolean(billing.data?.canExportCsv);
  const canSaveView = user?.role !== Role.VIEWER;
  const viewsQuery = useSavedViews();
  const selectedFromList = viewsQuery.data?.find((view) => view.id === viewId);
  const selectedQuery = useSavedView(viewId && !selectedFromList ? viewId : undefined);
  const selectedView = selectedFromList ?? selectedQuery.data;
  const createView = useCreateSavedView();
  const archiveView = useArchiveSavedView();
  const previewQuery = usePreviewSavedView(selectedView?.id);

  useEffect(() => {
    if (viewId) return;
    const urlQ = (searchParams.get('q') ?? '').trim();
    setQ(urlQ);
    setSearch(urlQ);
    setPage(1);
  }, [searchParams, viewId]);

  useEffect(() => {
    if (viewId) return;
    setStatus('');
    setHasWebsite('');
    setExtras({});
  }, [viewId]);

  const selectedViewId = selectedView?.id;
  const selectedViewUpdatedAt = selectedView?.updatedAt;
  useEffect(() => {
    if (!selectedView) return;
    const definition = selectedView.definition ?? {};
    setQ(definition.q ?? '');
    setSearch(definition.q ?? '');
    setStatus((definition.status as LeadStatus | undefined) ?? '');
    setHasWebsite(
      definition.hasWebsite === true ? 'yes' : definition.hasWebsite === false ? 'no' : '',
    );
    const { q: _q, status: _status, hasWebsite: _hasWebsite, ...rest } = definition;
    setExtras(rest);
    setPage(1);
    // Reapply only when the selected view identity or server timestamp changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedViewId, selectedViewUpdatedAt]);

  const listQuery: LeadsQuery = {
    page,
    pageSize: 15,
    q: search || undefined,
    status: status || undefined,
    hasWebsite: hasWebsite === '' ? undefined : hasWebsite === 'yes',
    source: extras.source,
    category: extras.category,
    segment: extras.segment,
    city: extras.city,
    ownerId: extras.ownerId,
    tagId: extras.tagId,
    minScore: extras.minScore,
    maxScore: extras.maxScore,
    sortBy: extras.sortBy ?? 'createdAt',
    sortOrder: extras.sortOrder ?? 'desc',
  };
  const query = useLeads(listQuery);

  const leads = query.data?.data ?? [];
  const meta = query.data?.meta;

  const applySearch = () => {
    const term = q.trim();
    setPage(1);
    setSearch(term);
    if (viewId) return;
    navigate(term ? `/leads?q=${encodeURIComponent(term)}` : '/leads', { replace: true });
  };

  const selectView = (id: string) => {
    setPage(1);
    navigate(id ? `/leads?view=${encodeURIComponent(id)}` : '/leads', { replace: true });
  };

  const saveCurrentView = async () => {
    const name = viewName.trim();
    if (!name) return;
    setActionError(null);
    try {
      const saved = await createView.mutateAsync({
        name,
        visibility: viewVisibility,
        definition: definitionFromFilters({ q, status, hasWebsite, extras }),
      });
      setSaveViewOpen(false);
      setViewName('');
      setExportMessage(t('leads.viewSaved'));
      selectView(saved.id);
    } catch (error) {
      setActionError(getApiErrorMessage(error) || t('common.errorGeneric'));
    }
  };

  const archiveCurrentView = async () => {
    if (!selectedView || !selectedView.canEdit) return;
    setActionError(null);
    try {
      await archiveView.mutateAsync(selectedView.id);
      setExportMessage(t('leads.viewArchived'));
      navigate('/leads', { replace: true });
    } catch (error) {
      setActionError(getApiErrorMessage(error) || t('common.errorGeneric'));
    }
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
        source: extras.source,
        category: extras.category,
        segment: extras.segment,
        city: extras.city,
        ownerId: extras.ownerId,
        tagId: extras.tagId,
        minScore: extras.minScore,
        maxScore: extras.maxScore,
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
      `Apagar o cliente "${companyName}"? Ele será removido da lista.`,
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
            {canExportCsv ? (
              <Button variant="outline" onClick={() => setExportOpen(true)}>
                <Download className="h-4 w-4" aria-hidden />
                {t('leads.export')}
              </Button>
            ) : null}
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              {t('principal.newClient')}
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="space-y-4 border-b border-[color:var(--border)] p-4 sm:p-5">
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:max-w-xs sm:flex-1">
              <Select
                id="leads-saved-view"
                label={t('leads.viewsLabel')}
                value={viewId}
                onChange={(event) => selectView(event.target.value)}
              >
                <option value="">{t('leads.viewsNone')}</option>
                {(viewsQuery.data ?? []).map((view) => (
                  <option key={view.id} value={view.id}>
                    {view.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              {canSaveView ? (
                <Button type="button" variant="outline" onClick={() => setSaveViewOpen(true)}>
                  {t('leads.saveView')}
                </Button>
              ) : null}
              {canSaveView && selectedView?.canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  loading={archiveView.isPending}
                  onClick={() => void archiveCurrentView()}
                >
                  {t('leads.archiveView')}
                </Button>
              ) : null}
            </div>
          </div>
          {previewQuery.data && selectedView ? (
            <p className="text-sm text-[color:var(--ink-muted)]">
              {t('leads.viewCount', { count: previewQuery.data.total })}
            </p>
          ) : null}
        </div>

        {exportMessage ? <Alert tone="success">{exportMessage}</Alert> : null}
        {actionError ? (
          <div className="px-5">
            <Alert tone="error">{actionError}</Alert>
          </div>
        ) : null}

        {query.isLoading ? (
          <div className="p-5">
            <TableSkeleton rows={8} columns={5} />
          </div>
        ) : query.isError ? (
          <div className="p-5">
            <Alert tone="error">Erro ao carregar clientes. Tente novamente.</Alert>
          </div>
        ) : leads.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Nenhum cliente encontrado"
              description="Ajuste os filtros ou crie o primeiro cliente manualmente."
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
            <ul className="divide-y divide-[color:var(--border)] md:hidden">
              {leads.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-2 px-4 py-3.5 text-left hover:bg-[color:var(--surface-hover)]"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[color:var(--ink)]">
                          {lead.companyName}
                        </p>
                        <p className="text-xs text-[color:var(--ink-muted)]">
                          {[
                            lead.city,
                            lead.segment ??
                              (lead.category ? formatCategoryTag(lead.category) : null),
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </p>
                      </div>
                      <ScoreBadge score={lead.score} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <LeadStatusBadge status={lead.status} />
                      {!lead.website ? (
                        <Badge tone="amber" title="Sem site">
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
                  <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
                    <th scope="col" className="px-5 py-3 font-medium">
                      Empresa
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Cidade
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Pontuação
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Responsável
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Etiquetas
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="cursor-pointer border-b border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <Link
                              to={`/leads/${lead.id}`}
                              className="font-medium text-[color:var(--ink)] hover:text-[color:var(--accent)]"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {lead.companyName}
                            </Link>
                            <p className="text-xs text-[color:var(--ink-muted)]">
                              {lead.segment ??
                                (lead.category ? formatCategoryTag(lead.category) : '—')}
                            </p>
                          </div>
                          {!lead.website ? (
                            <Badge tone="amber" title="Sem website">
                              <Globe className="h-3 w-3" aria-hidden /> sem site
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[color:var(--ink-muted)]">
                        {lead.city ?? '—'}
                      </td>
                      <td className="px-5 py-3">
                        <LeadStatusBadge status={lead.status} />
                      </td>
                      <td className="px-5 py-3">
                        <ScoreBadge score={lead.score} />
                      </td>
                      <td className="px-5 py-3 text-[color:var(--ink-muted)]">
                        {lead.owner?.name ?? '—'}
                      </td>
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
                          aria-label={`Apagar cliente ${lead.companyName}`}
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
              <div className="border-t border-[color:var(--border)] px-4 py-3">
                <Pagination
                  page={meta.page}
                  totalPages={meta.totalPages}
                  total={meta.total}
                  onPageChange={setPage}
                />
              </div>
            ) : null}
          </>
        )}
      </Card>

      <LeadFormModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title={t('leads.exportTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-[color:var(--ink-muted)]">{t('leads.exportColumns')}</p>
          <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-[color:var(--border)] p-3">
            {EXPORTABLE_LEAD_COLUMNS.map((column) => (
              <label
                key={column}
                className="flex items-center gap-2 text-sm text-[color:var(--ink)]"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[color:var(--border)] text-brand-400 focus:ring-[color:var(--ring)]"
                  checked={exportColumns.includes(column)}
                  onChange={() => toggleExportColumn(column)}
                />
                <span>{column}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-[color:var(--ink-muted)]">
            Os filtros atuais (busca, status, website e vista) serão aplicados à exportação.
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

      <Modal
        open={saveViewOpen}
        onClose={() => setSaveViewOpen(false)}
        title={t('leads.saveViewTitle')}
      >
        <div className="space-y-4">
          <Input
            id="saved-view-name"
            name="viewName"
            label={t('leads.saveViewName')}
            value={viewName}
            onChange={(event) => setViewName(event.target.value)}
            maxLength={120}
          />
          <Select
            id="saved-view-visibility"
            label={t('leads.saveViewVisibility')}
            value={viewVisibility}
            onChange={(event) => setViewVisibility(event.target.value as SavedViewVisibility)}
          >
            <option value="PRIVATE">{t('leads.saveViewPrivate')}</option>
            <option value="TEAM">{t('leads.saveViewTeam')}</option>
          </Select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setSaveViewOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              loading={createView.isPending}
              disabled={!viewName.trim()}
              onClick={() => void saveCurrentView()}
            >
              {t('leads.saveViewSubmit')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

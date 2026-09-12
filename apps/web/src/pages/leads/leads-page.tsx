import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  DEFAULT_EXPORT_COLUMNS,
  type ExportableLeadColumn,
  downloadCsvFile,
  exportLeadsCsv,
} from '@/features/leads/api';
import { LeadFormModal } from '@/features/leads/components/lead-form-modal';
import { LeadsExportDialog } from '@/features/leads/components/leads-export-dialog';
import { LeadsListResults } from '@/features/leads/components/leads-list-results';
import { LeadsListToolbar } from '@/features/leads/components/leads-list-toolbar';
import { LeadsSaveViewDialog } from '@/features/leads/components/leads-save-view-dialog';
import { getApiErrorMessage } from '@/lib/api';
import { useBillingStatus } from '@/features/billing/hooks';
import { useCustomFields } from '@/features/custom-fields/hooks';
import { useDeleteLead, useLeads } from '@/features/leads/hooks';
import {
  useArchiveSavedView,
  useCreateSavedView,
  useDuplicateSavedView,
  usePreviewSavedView,
  useSavedView,
  useSavedViews,
  useUpdateSavedView,
} from '@/features/saved-views/hooks';
import type { LeadViewDefinition, SavedViewVisibility } from '@/features/saved-views/api';
import {
  DEFAULT_LAST_CONTACT_DAYS,
  DEFAULT_LEAD_VIEW_COLUMNS,
  definitionFromFilters,
  hydrateLeadListFilters,
  leadExportFiltersFromList,
  leadsQueryFromFilters,
  type CustomFieldListFilter,
  type LastContactOp,
  type LeadViewColumnKey,
  type LeadViewLayout,
} from '@/features/saved-views/lead-filter';
import type { ReportBucket, ReportPeriod } from '@/features/reports/api';
import { useFunnelConversionLeads } from '@/features/reports/hooks';
import { useAuthStore } from '@/stores/auth.store';
import { LeadSource, LeadStatus, Role } from '@/types';

export function LeadsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [searchParams] = useSearchParams();
  const initialQ = (searchParams.get('q') ?? '').trim();
  const viewId = (searchParams.get('view') ?? '').trim();
  const reportBucketParam = searchParams.get('reportBucket');
  const reportBucket: ReportBucket | null =
    reportBucketParam === 'inflow' || reportBucketParam === 'wins' || reportBucketParam === 'losses'
      ? reportBucketParam
      : null;
  const reportPeriod = (['7d', '30d', '90d'] as ReportPeriod[]).includes(
    searchParams.get('period') as ReportPeriod,
  )
    ? (searchParams.get('period') as ReportPeriod)
    : '30d';
  const reportSourceParam = searchParams.get('source');
  const reportSource = (Object.values(LeadSource) as string[]).includes(reportSourceParam ?? '')
    ? (reportSourceParam as LeadSource)
    : undefined;
  const reportOwnerId = searchParams.get('ownerId') || undefined;
  const [page, setPage] = useState(1);
  const [q, setQ] = useState(initialQ);
  const [search, setSearch] = useState(initialQ);
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [statusOr, setStatusOr] = useState<LeadStatus | ''>('');
  const [hasWebsite, setHasWebsite] = useState<'' | 'yes' | 'no'>('');
  const [lastContactOp, setLastContactOp] = useState<LastContactOp>('');
  const [lastContactDays, setLastContactDays] = useState(DEFAULT_LAST_CONTACT_DAYS);
  const [layout, setLayout] = useState<LeadViewLayout>('table');
  const [columns, setColumns] = useState<LeadViewColumnKey[]>([...DEFAULT_LEAD_VIEW_COLUMNS]);
  const [customFilters, setCustomFilters] = useState<CustomFieldListFilter[]>([]);
  const [extras, setExtras] = useState<LeadViewDefinition>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveMode, setSaveMode] = useState<'create' | 'update'>('create');
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
  const customFieldsQuery = useCustomFields();
  const customFields = customFieldsQuery.data ?? [];
  const viewsQuery = useSavedViews();
  const selectedFromList = viewsQuery.data?.find((view) => view.id === viewId);
  const selectedQuery = useSavedView(viewId && !selectedFromList ? viewId : undefined);
  const selectedView = selectedFromList ?? selectedQuery.data;
  const createView = useCreateSavedView();
  const updateView = useUpdateSavedView();
  const duplicateView = useDuplicateSavedView();
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
    setStatusOr('');
    setHasWebsite('');
    setLastContactOp('');
    setLastContactDays(DEFAULT_LAST_CONTACT_DAYS);
    setLayout('table');
    setColumns([...DEFAULT_LEAD_VIEW_COLUMNS]);
    setCustomFilters([]);
    setExtras({});
  }, [viewId]);

  const selectedViewId = selectedView?.id;
  const selectedViewUpdatedAt = selectedView?.updatedAt;
  useEffect(() => {
    if (!selectedView) return;
    const definition = selectedView.definition ?? {};
    const hydrated = hydrateLeadListFilters(definition);
    setQ(hydrated.q);
    setSearch(hydrated.q);
    setStatus(hydrated.status);
    setStatusOr(hydrated.statusOr);
    setHasWebsite(hydrated.hasWebsite);
    setLastContactOp(hydrated.lastContactOp);
    setLastContactDays(hydrated.lastContactDays);
    setLayout(hydrated.layout);
    setColumns(hydrated.columns);
    setCustomFilters(hydrated.customFilters);
    setExtras(hydrated.extras);
    setPage(1);
    // Reapply only when the selected view identity or server timestamp changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedViewId, selectedViewUpdatedAt]);

  const idsQuery = useFunnelConversionLeads(
    {
      bucket: reportBucket ?? 'wins',
      period: reportPeriod,
      source: reportSource,
      ownerId: reportOwnerId,
    },
    { enabled: Boolean(reportBucket) },
  );
  const listQuery = {
    ...leadsQueryFromFilters(
      {
        q: search,
        status,
        statusOr,
        hasWebsite,
        lastContactOp,
        lastContactDays,
        layout,
        columns,
        customFilters,
        extras,
      },
      page,
    ),
    ...(reportBucket && idsQuery.isSuccess ? { ids: idsQuery.data?.ids ?? [] } : {}),
  };
  const waitingForReportIds = Boolean(reportBucket) && !idsQuery.isSuccess && !idsQuery.isError;
  const reportIdsFailed = Boolean(reportBucket) && idsQuery.isError;
  const query = useLeads(listQuery, { enabled: !waitingForReportIds && !reportIdsFailed });

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

  const openCreateView = () => {
    setSaveMode('create');
    setViewName('');
    setViewVisibility('PRIVATE');
    setSaveViewOpen(true);
  };

  const openUpdateView = () => {
    if (!selectedView?.canEdit) return;
    setSaveMode('update');
    setViewName(selectedView.name);
    setViewVisibility(selectedView.visibility);
    setSaveViewOpen(true);
  };

  const saveCurrentView = async () => {
    const name = viewName.trim();
    if (!name) return;
    setActionError(null);
    const definition = definitionFromFilters({
      q,
      status,
      statusOr,
      hasWebsite,
      lastContactOp,
      lastContactDays,
      layout,
      columns,
      customFilters,
      extras,
    });
    try {
      if (saveMode === 'update' && selectedView) {
        await updateView.mutateAsync({
          id: selectedView.id,
          name,
          visibility: viewVisibility,
          definition,
        });
        setSaveViewOpen(false);
        setExportMessage(t('leads.viewUpdated'));
        return;
      }
      const saved = await createView.mutateAsync({
        name,
        visibility: viewVisibility,
        definition,
      });
      setSaveViewOpen(false);
      setViewName('');
      setExportMessage(t('leads.viewSaved'));
      selectView(saved.id);
    } catch (error) {
      setActionError(getApiErrorMessage(error) || t('common.errorGeneric'));
    }
  };

  const duplicateCurrentView = async () => {
    if (!selectedView) return;
    setActionError(null);
    try {
      const copy = await duplicateView.mutateAsync(selectedView.id);
      setExportMessage(t('leads.viewDuplicated'));
      selectView(copy.id);
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
    if (reportBucket && !idsQuery.isSuccess) return;
    setExporting(true);
    setExportMessage(null);
    setActionError(null);
    try {
      const result = await exportLeadsCsv({
        columns: exportColumns,
        ...leadExportFiltersFromList({
          q: search,
          status,
          statusOr,
          hasWebsite,
          lastContactOp,
          lastContactDays,
          layout,
          columns,
          customFilters,
          extras,
        }),
        ...(reportBucket && idsQuery.isSuccess ? { ids: idsQuery.data?.ids ?? [] } : {}),
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
              <Button
                variant="outline"
                onClick={() => setExportOpen(true)}
                disabled={Boolean(reportBucket) && !idsQuery.isSuccess}
              >
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

      {reportBucket ? (
        <Card
          className="border-amber-500/30 bg-amber-500/10 p-4 text-sm text-[color:var(--ink)]"
          role="status"
        >
          {idsQuery.isError
            ? t('reports.loadError')
            : idsQuery.isSuccess
              ? t('leads.reportBucketBanner', { count: idsQuery.data?.total ?? 0 })
              : t('leads.reportBucketLoading')}{' '}
          <Link to="/reports" className="font-semibold text-[color:var(--accent)] hover:underline">
            {t('leads.backToReports')}
          </Link>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <LeadsListToolbar
          q={q}
          onQChange={setQ}
          onSearch={applySearch}
          status={status}
          onStatusChange={(value) => {
            setPage(1);
            setStatus(value);
          }}
          statusOr={statusOr}
          onStatusOrChange={(value) => {
            setPage(1);
            setStatusOr(value);
          }}
          hasWebsite={hasWebsite}
          onHasWebsiteChange={(value) => {
            setPage(1);
            setHasWebsite(value);
          }}
          lastContactOp={lastContactOp}
          onLastContactOpChange={(value) => {
            setPage(1);
            setLastContactOp(value);
          }}
          lastContactDays={lastContactDays}
          onLastContactDaysChange={(value) => {
            setPage(1);
            setLastContactDays(value);
          }}
          customFields={customFields}
          customFilters={customFilters}
          onCustomFiltersChange={(value) => {
            setPage(1);
            setCustomFilters(value);
          }}
          layout={layout}
          onLayoutChange={(value) => {
            setPage(1);
            setLayout(value);
          }}
          columns={columns}
          onColumnsChange={(value) => {
            setPage(1);
            setColumns(value);
          }}
          viewId={viewId}
          views={viewsQuery.data ?? []}
          onSelectView={selectView}
          canSaveView={canSaveView}
          selectedView={selectedView}
          duplicating={duplicateView.isPending}
          archiving={archiveView.isPending}
          previewCount={previewQuery.data?.total}
          onCreateView={openCreateView}
          onDuplicateView={() => void duplicateCurrentView()}
          onUpdateView={openUpdateView}
          onArchiveView={() => void archiveCurrentView()}
        />

        {exportMessage ? <Alert tone="success">{exportMessage}</Alert> : null}
        {actionError ? (
          <div className="px-5">
            <Alert tone="error">{actionError}</Alert>
          </div>
        ) : null}

        <LeadsListResults
          layout={layout}
          leads={leads}
          columns={columns}
          customFields={customFields}
          meta={meta}
          isLoading={query.isLoading}
          isError={query.isError}
          waitingForReportIds={waitingForReportIds}
          reportIdsFailed={reportIdsFailed}
          kanbanLabel={t('leads.kanbanLabel')}
          deletePendingId={deleteLead.isPending ? deleteLead.variables : undefined}
          onPageChange={setPage}
          onCreate={() => setModalOpen(true)}
          onDelete={(leadId, companyName) => void removeLead(leadId, companyName)}
          newClientLabel={t('principal.newClient')}
          t={t}
        />
      </Card>

      <LeadFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <LeadsExportDialog
        open={exportOpen}
        columns={exportColumns}
        exporting={exporting}
        onClose={() => setExportOpen(false)}
        onToggleColumn={toggleExportColumn}
        onExport={() => void runExport()}
      />
      <LeadsSaveViewDialog
        open={saveViewOpen}
        mode={saveMode}
        name={viewName}
        visibility={viewVisibility}
        saving={saveMode === 'update' ? updateView.isPending : createView.isPending}
        onClose={() => setSaveViewOpen(false)}
        onNameChange={setViewName}
        onVisibilityChange={setViewVisibility}
        onSave={() => void saveCurrentView()}
      />
    </div>
  );
}

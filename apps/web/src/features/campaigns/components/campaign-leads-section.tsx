import { Copy, ExternalLink, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import type {
  CampaignLeadResult,
  CampaignLeadRow,
  CampaignStage,
  MessageTemplate,
} from '@/features/campaigns/api';
import type { SavedView } from '@/features/saved-views/api';
import type { LeadListItem, PaginatedResult } from '@/types';

const RESULTS: CampaignLeadResult[] = [
  'CONTACTED',
  'REPLIED',
  'INTERESTED',
  'MEETING',
  'PROPOSAL',
  'WON',
  'LOST',
  'NO_RESPONSE',
  'OPT_OUT',
];

function formatCampaignLeadStatus(
  status: string,
  currentStageId: string | null | undefined,
  stages: CampaignStage[] | undefined,
): string {
  const currentStage = currentStageId
    ? stages?.find((stage) => stage.id === currentStageId)
    : undefined;
  if (currentStage) return currentStage.name;
  if (status === 'PENDING') return 'Pendente';
  return 'Em andamento';
}

export function CampaignLeadsSection({
  leads,
  leadsLoading,
  stages,
  campaignLeadIds,
  onOpenTemplates,
  onOpenPicker,
  onSelectLead,
  onRemoveLead,
  activeLead,
  resultValue,
  onResultValueChange,
  nextAction,
  onNextActionChange,
  followUpAt,
  onFollowUpAtChange,
  recordPending,
  onRecordResult,
  templates,
  onPreview,
  previewText,
  onCopy,
  pickerOpen,
  onClosePicker,
  onCancelPicker,
  views,
  selectedViewId,
  onSelectedViewIdChange,
  viewPreview,
  viewPreviewLoading,
  onAddFromView,
  addLeadsPending,
  leadSearch,
  onLeadSearchChange,
  availableLeads,
  availableLeadsLoading,
  selectedLeadIds,
  onToggleLead,
  onLeadPageChange,
  onAddSelectedLeads,
}: {
  leads: CampaignLeadRow[];
  leadsLoading: boolean;
  stages: CampaignStage[] | undefined;
  campaignLeadIds: Set<string>;
  onOpenTemplates: () => void;
  onOpenPicker: () => void;
  onSelectLead: (leadId: string) => void;
  onRemoveLead: (leadId: string) => void;
  activeLead: CampaignLeadRow | undefined;
  resultValue: CampaignLeadResult;
  onResultValueChange: (value: CampaignLeadResult) => void;
  nextAction: string;
  onNextActionChange: (value: string) => void;
  followUpAt: string;
  onFollowUpAtChange: (value: string) => void;
  recordPending: boolean;
  onRecordResult: () => void;
  templates: MessageTemplate[];
  onPreview: (body: string, subject?: string | null) => void;
  previewText: string | null;
  onCopy: (value: string) => void;
  pickerOpen: boolean;
  onClosePicker: () => void;
  onCancelPicker: () => void;
  views: SavedView[];
  selectedViewId: string;
  onSelectedViewIdChange: (viewId: string) => void;
  viewPreview: { total: number } | undefined;
  viewPreviewLoading: boolean;
  onAddFromView: () => void;
  addLeadsPending: boolean;
  leadSearch: string;
  onLeadSearchChange: (value: string) => void;
  availableLeads: PaginatedResult<LeadListItem> | undefined;
  availableLeadsLoading: boolean;
  selectedLeadIds: string[];
  onToggleLead: (leadId: string, checked: boolean) => void;
  onLeadPageChange: (page: number) => void;
  onAddSelectedLeads: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <section className="space-y-3" aria-labelledby="campaign-leads-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="campaign-leads-heading" className="text-lg font-medium text-[color:var(--ink)]">
            {t('campaigns.leadsTitle')}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={onOpenTemplates}>
            {t('campaigns.templatesManage')}
          </Button>
        </div>

        {leadsLoading ? (
          <TableSkeleton rows={4} />
        ) : leads.length === 0 ? (
          <EmptyState
            title={t('campaigns.leadsEmptyTitle')}
            description={t('campaigns.leadsEmptyDescription')}
            action={
              <Button type="button" onClick={onOpenPicker}>
                {t('campaigns.addLeads')}
              </Button>
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--ink-muted)]">
                  <tr>
                    <th className="px-4 py-3">{t('campaigns.leadColumns.company')}</th>
                    <th className="px-4 py-3">{t('campaigns.leadColumns.contact')}</th>
                    <th className="px-4 py-3">{t('campaigns.leadColumns.status')}</th>
                    <th className="px-4 py-3">{t('campaigns.leadColumns.result')}</th>
                    <th className="px-4 py-3">{t('campaigns.leadColumns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((row) => (
                    <tr
                      key={row.leadId}
                      className="border-b border-[color:var(--border)] text-[color:var(--ink)]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/leads/${row.leadId}`}
                          className="font-medium text-[color:var(--ink)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                        >
                          {row.lead.companyName}
                        </Link>
                        <div className="text-xs text-[color:var(--ink-muted)]">
                          {[row.lead.city, row.lead.state].filter(Boolean).join(' · ') || '—'}
                          {' · '}
                          {t('campaigns.score')}: {row.lead.score}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--ink-muted)]">
                        <div>{row.lead.email ?? '—'}</div>
                        <div>{row.lead.phone ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--ink-muted)]">
                        {formatCampaignLeadStatus(row.status, row.currentStageId, stages)}
                      </td>
                      <td className="px-4 py-3 text-[color:var(--ink-muted)]">
                        {row.result
                          ? t(`campaigns.results.${row.result}`, {
                              defaultValue: 'Resultado registrado',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onSelectLead(row.leadId)}
                          >
                            {t('campaigns.manualAction')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={t('campaigns.removeLead')}
                            onClick={() => {
                              if (window.confirm(t('campaigns.removeLeadConfirm'))) {
                                onRemoveLead(row.leadId);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      {activeLead ? (
        <Card className="space-y-4 p-4">
          <CardHeader
            title={t('campaigns.manualPanelTitle', { company: activeLead.lead.companyName })}
            description={t('campaigns.manualPanelDesc')}
          />
          <div className="flex flex-wrap gap-2">
            {activeLead.lead.email ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onCopy(activeLead.lead.email!)}
              >
                <Copy className="mr-2 h-4 w-4" aria-hidden />
                {t('campaigns.copyEmail')}
              </Button>
            ) : null}
            {activeLead.lead.phone ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onCopy(activeLead.lead.phone!)}
              >
                <Copy className="mr-2 h-4 w-4" aria-hidden />
                {t('campaigns.copyPhone')}
              </Button>
            ) : null}
            {activeLead.lead.phone ? (
              <a
                href={`https://wa.me/${activeLead.lead.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-2 rounded-control px-3 text-sm text-[color:var(--ink)] hover:bg-[color:var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                {t('campaigns.openWhatsApp')}
              </a>
            ) : null}
            <Link
              to={`/leads/${activeLead.leadId}`}
              className="inline-flex h-8 items-center rounded-control px-3 text-sm text-[color:var(--ink)] hover:bg-[color:var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              {t('campaigns.openLead')}
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm text-[color:var(--ink)]">
              {t('campaigns.resultLabel')}
              <select
                className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface-card)] px-3 py-2"
                value={resultValue}
                onChange={(e) => onResultValueChange(e.target.value as CampaignLeadResult)}
              >
                {RESULTS.map((result) => (
                  <option key={result} value={result}>
                    {t(`campaigns.results.${result}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[color:var(--ink)]">
              {t('campaigns.nextAction')}
              <Input
                className="mt-1"
                value={nextAction}
                onChange={(e) => onNextActionChange(e.target.value)}
              />
            </label>
            <label className="text-sm text-[color:var(--ink)]">
              {t('campaigns.followUpAt')}
              <Input
                className="mt-1"
                type="datetime-local"
                value={followUpAt}
                onChange={(e) => onFollowUpAtChange(e.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" loading={recordPending} onClick={onRecordResult}>
              {t('campaigns.saveResult')}
            </Button>
            {templates.slice(0, 3).map((template) => (
              <Button
                key={template.id}
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onPreview(template.body, template.subject)}
              >
                {t('campaigns.previewTemplate', { name: template.name })}
              </Button>
            ))}
          </div>

          {previewText ? (
            <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-card)] p-3 text-sm text-[color:var(--ink)]">
              <p className="mb-2 text-xs text-amber-200">{t('campaigns.previewNotice')}</p>
              <pre className="whitespace-pre-wrap font-sans">{previewText}</pre>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                variant="ghost"
                onClick={() => onCopy(previewText)}
              >
                {t('campaigns.copyMessage')}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Modal open={pickerOpen} onClose={onClosePicker} title={t('campaigns.addLeads')}>
        <div className="space-y-4">
          <Select
            id="campaign-saved-view"
            label={t('campaigns.savedView')}
            value={selectedViewId}
            onChange={(event) => onSelectedViewIdChange(event.target.value)}
          >
            <option value="">{t('campaigns.chooseView')}</option>
            {views.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </Select>
          {selectedViewId && viewPreview ? (
            <p className="text-sm text-[color:var(--ink-muted)]">
              {t('campaigns.viewMatchCount', { count: viewPreview.total })}
            </p>
          ) : null}
          {selectedViewId && viewPreview && viewPreview.total > 200 ? (
            <p className="text-sm text-amber-300" role="alert">
              {t('campaigns.viewTooLarge')}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="button"
              loading={addLeadsPending}
              disabled={
                !selectedViewId ||
                viewPreviewLoading ||
                !viewPreview ||
                viewPreview.total === 0 ||
                viewPreview.total > 200
              }
              onClick={onAddFromView}
            >
              {t('campaigns.addFromView')}
            </Button>
          </div>
          <Input
            value={leadSearch}
            onChange={(e) => onLeadSearchChange(e.target.value)}
            placeholder={t('campaigns.searchLeads')}
            aria-label={t('campaigns.searchLeads')}
          />
          {availableLeadsLoading ? (
            <TableSkeleton rows={4} />
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {(availableLeads?.data ?? []).map((lead) => {
                const alreadyIn = campaignLeadIds.has(lead.id);
                const blocked = lead.doNotContact;
                const checked = selectedLeadIds.includes(lead.id);
                return (
                  <li key={lead.id}>
                    <label
                      className={`flex items-start gap-3 rounded-md border border-[color:var(--border)] p-3 ${
                        blocked ? 'opacity-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        disabled={blocked || alreadyIn}
                        checked={checked || alreadyIn}
                        onChange={(e) => onToggleLead(lead.id, e.target.checked)}
                      />
                      <span>
                        <span className="block font-medium text-[color:var(--ink)]">
                          {lead.companyName}
                        </span>
                        <span className="block text-xs text-[color:var(--ink-muted)]">
                          {[lead.city, lead.email, lead.phone].filter(Boolean).join(' · ')}
                        </span>
                        {blocked ? (
                          <span className="mt-1 block text-xs text-amber-300">
                            {t('campaigns.doNotContactBlocked')}
                          </span>
                        ) : null}
                        {alreadyIn ? (
                          <span className="mt-1 block text-xs text-[color:var(--ink-muted)]">
                            {t('campaigns.alreadyInCampaign')}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {availableLeads?.meta ? (
            <Pagination
              page={availableLeads.meta.page}
              totalPages={availableLeads.meta.totalPages}
              total={availableLeads.meta.total}
              onPageChange={onLeadPageChange}
            />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancelPicker}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              loading={addLeadsPending}
              disabled={selectedLeadIds.length === 0}
              onClick={onAddSelectedLeads}
            >
              {t('campaigns.addSelected', { count: selectedLeadIds.length })}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

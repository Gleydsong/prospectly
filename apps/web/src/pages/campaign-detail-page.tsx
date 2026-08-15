import { Copy, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import type { CampaignLeadResult, CampaignStage, CampaignStatus } from '@/features/campaigns/api';
import {
  useAddCampaignLeads,
  useCampaign,
  useCampaignLeads,
  useCampaignMetrics,
  useCreateMessageTemplate,
  useCreateStageTasks,
  useMessageTemplates,
  usePreviewMessageTemplate,
  useRecordCampaignLeadResult,
  useRemoveCampaignLead,
  useTemplateVariables,
  useUpdateCampaignStatus,
} from '@/features/campaigns/hooks';
import { useLeads } from '@/features/leads/hooks';
import { getApiErrorMessage } from '@/lib/api';
import { formatMessageTemplateCategory } from '@/lib/presentation-labels';
import { formatDate } from '@/lib/utils';

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

const STATUS_ACTIONS: Partial<Record<CampaignStatus, CampaignStatus[]>> = {
  DRAFT: ['SCHEDULED', 'RUNNING', 'CANCELLED'],
  SCHEDULED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['PAUSED', 'COMPLETED', 'CANCELLED'],
  PAUSED: ['RUNNING', 'COMPLETED', 'CANCELLED'],
};

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

export function CampaignDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const campaignQuery = useCampaign(id);
  const metricsQuery = useCampaignMetrics(id);
  const leadsQuery = useCampaignLeads(id, { page: 1, pageSize: 50 });
  const templatesQuery = useMessageTemplates({ page: 1, pageSize: 50 });
  const variablesQuery = useTemplateVariables();

  const updateStatus = useUpdateCampaignStatus(id);
  const addLeads = useAddCampaignLeads(id);
  const removeLead = useRemoveCampaignLead(id);
  const createTasks = useCreateStageTasks(id);
  const recordResult = useRecordCampaignLeadResult(id);
  const createTemplate = useCreateMessageTemplate();
  const previewTemplate = usePreviewMessageTemplate();

  const [leadSearch, setLeadSearch] = useState('');
  const [leadPage, setLeadPage] = useState(1);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [resultValue, setResultValue] = useState<CampaignLeadResult>('CONTACTED');
  const [nextAction, setNextAction] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [liveMessage, setLiveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    category: 'EMAIL',
    subject: '',
    body: 'Olá {{contactName}}, vi a {{companyName}} em {{city}}.',
  });

  const availableLeadsQuery = useLeads({
    page: leadPage,
    pageSize: 10,
    q: leadSearch || undefined,
  });

  const campaign = campaignQuery.data;
  const metrics = metricsQuery.data;
  const campaignLeadIds = useMemo(
    () => new Set((leadsQuery.data?.data ?? []).map((row) => row.leadId)),
    [leadsQuery.data],
  );

  const activeLead = (leadsQuery.data?.data ?? []).find((row) => row.leadId === activeLeadId);

  async function handleStatus(status: CampaignStatus) {
    setError(null);
    try {
      await updateStatus.mutateAsync(status);
      setLiveMessage(t('campaigns.statusUpdated'));
    } catch (err) {
      setError(getApiErrorMessage(err) || t('campaigns.actionError'));
    }
  }

  async function handleAddSelectedLeads() {
    if (selectedLeadIds.length === 0) return;
    setError(null);
    try {
      await addLeads.mutateAsync(selectedLeadIds);
      setSelectedLeadIds([]);
      setPickerOpen(false);
      setLiveMessage(t('campaigns.leadsAdded'));
    } catch (err) {
      setError(getApiErrorMessage(err) || t('campaigns.actionError'));
    }
  }

  async function handleCreateTasks(stageId: string) {
    setError(null);
    try {
      const result = await createTasks.mutateAsync({ stageId });
      setLiveMessage(
        t('campaigns.tasksCreated', {
          created: result.tasksCreated,
          skipped: result.tasksSkipped,
        }),
      );
    } catch (err) {
      setError(getApiErrorMessage(err) || t('campaigns.actionError'));
    }
  }

  async function handleRecordResult() {
    if (!activeLeadId) return;
    setError(null);
    try {
      const result = await recordResult.mutateAsync({
        leadId: activeLeadId,
        result: resultValue,
        nextAction: nextAction || undefined,
        followUpAt: followUpAt || undefined,
      });
      expectNoSend(result);
      setLiveMessage(t('campaigns.resultSaved'));
      setNextAction('');
      setFollowUpAt('');
    } catch (err) {
      setError(getApiErrorMessage(err) || t('campaigns.actionError'));
    }
  }

  async function handlePreview(templateBody: string, subject?: string | null) {
    if (!activeLead) return;
    setError(null);
    try {
      const preview = await previewTemplate.mutateAsync({
        subject: subject ?? undefined,
        body: templateBody,
        values: {
          companyName: activeLead.lead.companyName,
          contactName: activeLead.lead.tradeName || activeLead.lead.companyName,
          email: activeLead.lead.email || '',
          phone: activeLead.lead.phone || '',
          city: activeLead.lead.city || '',
          website: activeLead.lead.website || '',
        },
      });
      expectNoSend(preview);
      setPreviewText([preview.subject, preview.body].filter(Boolean).join('\n\n'));
    } catch (err) {
      setError(getApiErrorMessage(err) || t('campaigns.actionError'));
    }
  }

  async function handleCreateTemplate() {
    setError(null);
    try {
      await createTemplate.mutateAsync(templateForm);
      setTemplateOpen(false);
      setLiveMessage(t('campaigns.templateSaved'));
    } catch (err) {
      setError(getApiErrorMessage(err) || t('campaigns.actionError'));
    }
  }

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
    setLiveMessage(t('campaigns.copied'));
  }

  if (campaignQuery.isLoading) {
    return <TableSkeleton rows={6} />;
  }

  if (campaignQuery.isError || !campaign) {
    return (
      <Card className="p-6 text-sm text-red-300" role="alert">
        {t('campaigns.loadError')}
        <div className="mt-3">
          <Link
            to="/campaigns"
            className="text-sm text-zinc-300 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            {t('campaigns.backToList')}
          </Link>
        </div>
      </Card>
    );
  }

  const nextStatuses = STATUS_ACTIONS[campaign.status] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/campaigns"
            className="mb-2 inline-block text-sm text-zinc-300 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            {t('campaigns.backToList')}
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-50">{campaign.name}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {campaign.description || t('campaigns.noDescription')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
            <Badge>
              {t(`campaigns.status.${campaign.status}`, {
                defaultValue: 'Estado não identificado',
              })}
            </Badge>
            <span>{t('campaigns.columns.segment')}: {campaign.segment ?? '—'}</span>
            <span>{t('campaigns.columns.owner')}: {campaign.owner?.name ?? '—'}</span>
            <span>{t('campaigns.columns.updated')}: {formatDate(campaign.updatedAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant="ghost"
              loading={updateStatus.isPending}
              onClick={() => void handleStatus(status)}
            >
              {t(`campaigns.statusAction.${status}`, {
                defaultValue: t(`campaigns.status.${status}`),
              })}
            </Button>
          ))}
          <Button type="button" onClick={() => setPickerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            {t('campaigns.addLeads')}
          </Button>
        </div>
      </div>

      <Card className="border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100/90" role="note">
        {t('campaigns.assistedNotice')}
      </Card>

      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['leads', metrics?.totals.leads ?? campaign._count?.leads ?? 0],
          ['pending', metrics?.totals.pending ?? 0],
          ['openTasks', metrics?.totals.openTasks ?? 0],
          ['contacted', metrics?.totals.contacted ?? 0],
          ['replied', metrics?.totals.replied ?? 0],
          ['meeting', metrics?.totals.meeting ?? 0],
          ['proposal', metrics?.totals.proposal ?? 0],
          ['won', metrics?.totals.won ?? 0],
          ['optOut', metrics?.totals.optOut ?? 0],
        ].map(([key, value]) => (
          <Card key={key} className="p-4">
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t(`campaigns.metrics.${key}`)}
            </div>
            <div className="mt-1 text-2xl font-semibold text-zinc-50">{value}</div>
          </Card>
        ))}
      </div>
      {metrics ? (
        <p className="text-xs text-zinc-500">
          {metrics.eventsRecorded === 0
            ? t('campaigns.metrics.zeroEvents')
            : t('campaigns.metrics.eventsRecorded', { count: metrics.eventsRecorded })}
        </p>
      ) : null}

      <section className="space-y-3" aria-labelledby="campaign-stages-heading">
        <h2 id="campaign-stages-heading" className="text-lg font-medium text-zinc-100">
          {t('campaigns.stagesTitle')}
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {(metrics?.stages ?? campaign.metrics?.stages ?? []).map((stage) => (
            <Card key={stage.id} className="p-4">
              <CardHeader
                title={stage.name}
                description={t(`campaigns.stageType.${stage.type}`, { defaultValue: 'Etapa manual' })}
              />
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-400">
                <span>
                  {t('campaigns.metrics.leads')}: {'leadCount' in stage ? stage.leadCount : campaign.stageCounts?.[stage.id] ?? 0}
                </span>
                <span>
                  {t('campaigns.metrics.openTasks')}: {'openTasks' in stage ? stage.openTasks : 0}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  loading={createTasks.isPending}
                  onClick={() => void handleCreateTasks(stage.id)}
                >
                  {t('campaigns.createTasks')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="campaign-leads-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="campaign-leads-heading" className="text-lg font-medium text-zinc-100">
            {t('campaigns.leadsTitle')}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => setTemplateOpen(true)}>
            {t('campaigns.templatesManage')}
          </Button>
        </div>

        {leadsQuery.isLoading ? (
          <TableSkeleton rows={4} />
        ) : (leadsQuery.data?.data.length ?? 0) === 0 ? (
          <EmptyState
            title={t('campaigns.leadsEmptyTitle')}
            description={t('campaigns.leadsEmptyDescription')}
            action={
              <Button type="button" onClick={() => setPickerOpen(true)}>
                {t('campaigns.addLeads')}
              </Button>
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">{t('campaigns.leadColumns.company')}</th>
                    <th className="px-4 py-3">{t('campaigns.leadColumns.contact')}</th>
                    <th className="px-4 py-3">{t('campaigns.leadColumns.status')}</th>
                    <th className="px-4 py-3">{t('campaigns.leadColumns.result')}</th>
                    <th className="px-4 py-3">{t('campaigns.leadColumns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(leadsQuery.data?.data ?? []).map((row) => (
                    <tr key={row.leadId} className="border-b border-zinc-800/80 text-zinc-200">
                      <td className="px-4 py-3">
                        <Link
                          to={`/leads/${row.leadId}`}
                          className="font-medium text-zinc-50 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                        >
                          {row.lead.companyName}
                        </Link>
                        <div className="text-xs text-zinc-500">
                          {[row.lead.city, row.lead.state].filter(Boolean).join(' · ') || '—'}
                          {' · '}
                          {t('campaigns.score')}: {row.lead.score}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        <div>{row.lead.email ?? '—'}</div>
                        <div>{row.lead.phone ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {formatCampaignLeadStatus(
                          row.status,
                          row.currentStageId,
                          campaign?.metrics?.stages,
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
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
                            onClick={() => setActiveLeadId(row.leadId)}
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
                                void removeLead.mutateAsync(row.leadId).then(() => {
                                  setLiveMessage(t('campaigns.leadRemoved'));
                                });
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
                onClick={() => void copyText(activeLead.lead.email!)}
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
                onClick={() => void copyText(activeLead.lead.phone!)}
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
                className="inline-flex h-8 items-center gap-2 rounded-control px-3 text-sm text-zinc-300 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                {t('campaigns.openWhatsApp')}
              </a>
            ) : null}
            <Link
              to={`/leads/${activeLead.leadId}`}
              className="inline-flex h-8 items-center rounded-control px-3 text-sm text-zinc-300 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              {t('campaigns.openLead')}
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm text-zinc-300">
              {t('campaigns.resultLabel')}
              <select
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
                value={resultValue}
                onChange={(e) => setResultValue(e.target.value as CampaignLeadResult)}
              >
                {RESULTS.map((result) => (
                  <option key={result} value={result}>
                    {t(`campaigns.results.${result}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-zinc-300">
              {t('campaigns.nextAction')}
              <Input className="mt-1" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
            </label>
            <label className="text-sm text-zinc-300">
              {t('campaigns.followUpAt')}
              <Input
                className="mt-1"
                type="datetime-local"
                value={followUpAt}
                onChange={(e) => setFollowUpAt(e.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" loading={recordResult.isPending} onClick={() => void handleRecordResult()}>
              {t('campaigns.saveResult')}
            </Button>
            {(templatesQuery.data?.data ?? []).slice(0, 3).map((template) => (
              <Button
                key={template.id}
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void handlePreview(template.body, template.subject)}
              >
                {t('campaigns.previewTemplate', { name: template.name })}
              </Button>
            ))}
          </div>

          {previewText ? (
            <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200">
              <p className="mb-2 text-xs text-amber-200">{t('campaigns.previewNotice')}</p>
              <pre className="whitespace-pre-wrap font-sans">{previewText}</pre>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                variant="ghost"
                onClick={() => void copyText(previewText)}
              >
                {t('campaigns.copyMessage')}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title={t('campaigns.addLeads')}>
        <div className="space-y-4">
          <Input
            value={leadSearch}
            onChange={(e) => {
              setLeadSearch(e.target.value);
              setLeadPage(1);
            }}
            placeholder={t('campaigns.searchLeads')}
            aria-label={t('campaigns.searchLeads')}
          />
          {availableLeadsQuery.isLoading ? (
            <TableSkeleton rows={4} />
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {(availableLeadsQuery.data?.data ?? []).map((lead) => {
                const alreadyIn = campaignLeadIds.has(lead.id);
                const blocked = lead.doNotContact;
                const checked = selectedLeadIds.includes(lead.id);
                return (
                  <li key={lead.id}>
                    <label
                      className={`flex items-start gap-3 rounded-md border border-zinc-800 p-3 ${
                        blocked ? 'opacity-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        disabled={blocked || alreadyIn}
                        checked={checked || alreadyIn}
                        onChange={(e) => {
                          setSelectedLeadIds((current) =>
                            e.target.checked
                              ? [...current, lead.id]
                              : current.filter((id) => id !== lead.id),
                          );
                        }}
                      />
                      <span>
                        <span className="block font-medium text-zinc-100">{lead.companyName}</span>
                        <span className="block text-xs text-zinc-500">
                          {[lead.city, lead.email, lead.phone].filter(Boolean).join(' · ')}
                        </span>
                        {blocked ? (
                          <span className="mt-1 block text-xs text-amber-300">
                            {t('campaigns.doNotContactBlocked')}
                          </span>
                        ) : null}
                        {alreadyIn ? (
                          <span className="mt-1 block text-xs text-zinc-500">
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
          {availableLeadsQuery.data?.meta ? (
            <Pagination
              page={availableLeadsQuery.data.meta.page}
              totalPages={availableLeadsQuery.data.meta.totalPages}
              total={availableLeadsQuery.data.meta.total}
              onPageChange={setLeadPage}
            />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setPickerOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              loading={addLeads.isPending}
              disabled={selectedLeadIds.length === 0}
              onClick={() => void handleAddSelectedLeads()}
            >
              {t('campaigns.addSelected', { count: selectedLeadIds.length })}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title={t('campaigns.templatesManage')}
      >
        <div className="space-y-4">
          <p className="text-xs text-amber-200">{t('campaigns.previewNotice')}</p>
          <p className="text-xs text-zinc-500">
            {t('campaigns.variablesHint')}: {(variablesQuery.data ?? []).join(', ')}
          </p>
          <Input
            value={templateForm.name}
            onChange={(e) => setTemplateForm((c) => ({ ...c, name: e.target.value }))}
            placeholder={t('campaigns.templateName')}
            aria-label={t('campaigns.templateName')}
          />
          <Input
            value={templateForm.category}
            onChange={(e) => setTemplateForm((c) => ({ ...c, category: e.target.value }))}
            placeholder={t('campaigns.templateCategory')}
            aria-label={t('campaigns.templateCategory')}
          />
          <Input
            value={templateForm.subject}
            onChange={(e) => setTemplateForm((c) => ({ ...c, subject: e.target.value }))}
            placeholder={t('campaigns.templateSubject')}
            aria-label={t('campaigns.templateSubject')}
          />
          <textarea
            className="min-h-28 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={templateForm.body}
            onChange={(e) => setTemplateForm((c) => ({ ...c, body: e.target.value }))}
            aria-label={t('campaigns.templateBody')}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setTemplateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              loading={createTemplate.isPending}
              onClick={() => void handleCreateTemplate()}
            >
              {t('campaigns.saveTemplate')}
            </Button>
          </div>
          <ul className="space-y-2 text-sm text-zinc-300">
            {(templatesQuery.data?.data ?? []).map((template) => (
              <li key={template.id} className="rounded-md border border-zinc-800 p-3">
                <div className="font-medium text-zinc-100">{template.name}</div>
                <div className="text-xs text-zinc-500">
                  {formatMessageTemplateCategory(template.category)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </div>
  );
}

function expectNoSend(payload: { autoSend?: boolean; messageSent?: boolean; autoSendEnabled?: boolean }) {
  if (payload.autoSend || payload.messageSent || payload.autoSendEnabled) {
    throw new Error('Unexpected auto-send flag in assisted campaign response');
  }
}

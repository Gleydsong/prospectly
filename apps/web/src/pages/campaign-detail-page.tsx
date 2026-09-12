import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { TableSkeleton } from '@/components/ui/skeleton';
import { expectNoSend } from '@/features/campaigns/campaign-assisted';
import { CampaignLeadsSection } from '@/features/campaigns/components/campaign-leads-section';
import { CampaignMetricsSection } from '@/features/campaigns/components/campaign-metrics-section';
import { CampaignStatusHeader } from '@/features/campaigns/components/campaign-status-header';
import {
  CampaignTemplatesModal,
  type CampaignTemplateForm,
} from '@/features/campaigns/components/campaign-templates-modal';
import type { CampaignLeadResult, CampaignStatus } from '@/features/campaigns/api';
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
import { usePreviewSavedView, useSavedViews } from '@/features/saved-views/hooks';
import { getApiErrorMessage } from '@/lib/api';

const INITIAL_TEMPLATE_FORM: CampaignTemplateForm = {
  name: '',
  category: 'EMAIL',
  subject: '',
  body: 'Olá {{contactName}}, vi a {{companyName}} em {{city}}.',
};

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
  const [selectedViewId, setSelectedViewId] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [resultValue, setResultValue] = useState<CampaignLeadResult>('CONTACTED');
  const [nextAction, setNextAction] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [liveMessage, setLiveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState(INITIAL_TEMPLATE_FORM);

  const availableLeadsQuery = useLeads({
    page: leadPage,
    pageSize: 10,
    q: leadSearch || undefined,
  });
  const viewsQuery = useSavedViews();
  const viewPreviewQuery = usePreviewSavedView(selectedViewId || undefined);

  const campaign = campaignQuery.data;
  const metrics = metricsQuery.data;
  const campaignLeads = leadsQuery.data?.data ?? [];
  const templates = templatesQuery.data?.data ?? [];
  const campaignLeadIds = useMemo(
    () => new Set((leadsQuery.data?.data ?? []).map((row) => row.leadId)),
    [leadsQuery.data],
  );

  const activeLead = campaignLeads.find((row) => row.leadId === activeLeadId);

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
      await addLeads.mutateAsync({ leadIds: selectedLeadIds });
      setSelectedLeadIds([]);
      setSelectedViewId('');
      setPickerOpen(false);
      setLiveMessage(t('campaigns.leadsAdded'));
    } catch (err) {
      setError(getApiErrorMessage(err) || t('campaigns.actionError'));
    }
  }

  async function handleAddFromView() {
    if (!selectedViewId) return;
    setError(null);
    try {
      await addLeads.mutateAsync({ viewId: selectedViewId });
      setSelectedLeadIds([]);
      setSelectedViewId('');
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
            className="text-sm text-[color:var(--ink)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            {t('campaigns.backToList')}
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CampaignStatusHeader
        campaign={campaign}
        statusPending={updateStatus.isPending}
        onStatus={(status) => void handleStatus(status)}
        onAddLeads={() => setPickerOpen(true)}
      />

      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <CampaignMetricsSection
        campaign={campaign}
        metrics={metrics}
        createTasksPending={createTasks.isPending}
        onCreateTasks={(stageId) => void handleCreateTasks(stageId)}
      />

      <CampaignLeadsSection
        leads={campaignLeads}
        leadsLoading={leadsQuery.isLoading}
        stages={campaign.metrics?.stages}
        campaignLeadIds={campaignLeadIds}
        onOpenTemplates={() => setTemplateOpen(true)}
        onOpenPicker={() => setPickerOpen(true)}
        onSelectLead={setActiveLeadId}
        onRemoveLead={(leadId) => {
          void removeLead.mutateAsync(leadId).then(() => {
            setLiveMessage(t('campaigns.leadRemoved'));
          });
        }}
        activeLead={activeLead}
        resultValue={resultValue}
        onResultValueChange={setResultValue}
        nextAction={nextAction}
        onNextActionChange={setNextAction}
        followUpAt={followUpAt}
        onFollowUpAtChange={setFollowUpAt}
        recordPending={recordResult.isPending}
        onRecordResult={() => void handleRecordResult()}
        templates={templates}
        onPreview={(body, subject) => void handlePreview(body, subject)}
        previewText={previewText}
        onCopy={(value) => void copyText(value)}
        pickerOpen={pickerOpen}
        onClosePicker={() => {
          setPickerOpen(false);
          setSelectedViewId('');
        }}
        onCancelPicker={() => setPickerOpen(false)}
        views={viewsQuery.data ?? []}
        selectedViewId={selectedViewId}
        onSelectedViewIdChange={setSelectedViewId}
        viewPreview={viewPreviewQuery.data}
        viewPreviewLoading={viewPreviewQuery.isLoading}
        onAddFromView={() => void handleAddFromView()}
        addLeadsPending={addLeads.isPending}
        leadSearch={leadSearch}
        onLeadSearchChange={(value) => {
          setLeadSearch(value);
          setLeadPage(1);
        }}
        availableLeads={availableLeadsQuery.data}
        availableLeadsLoading={availableLeadsQuery.isLoading}
        selectedLeadIds={selectedLeadIds}
        onToggleLead={(leadId, checked) => {
          setSelectedLeadIds((current) =>
            checked ? [...current, leadId] : current.filter((id) => id !== leadId),
          );
        }}
        onLeadPageChange={setLeadPage}
        onAddSelectedLeads={() => void handleAddSelectedLeads()}
      />

      <CampaignTemplatesModal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        variables={variablesQuery.data ?? []}
        templateForm={templateForm}
        onTemplateFormChange={setTemplateForm}
        templates={templates}
        creating={createTemplate.isPending}
        onCreate={() => void handleCreateTemplate()}
      />
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Workflow,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, Link } from 'react-router-dom';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LeadStatusStepper } from '@/features/leads/components/lead-status-stepper';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LeadActivityHub } from '@/features/leads/components/lead-activity-hub';
import { buildWhatsAppOutreachMessage } from '@/features/leads/components/lead-contact-channels';
import {
  WhatsAppOutreachModal,
  type WhatsAppOutreachModalLead,
} from '@/features/agents/components';
import { CopyButton } from '@/features/leads/components/lead-copy-button';
import {
  LeadPipelineStepper,
  findStageForStatus,
  orderedPipelineStages,
} from '@/features/leads/components/lead-pipeline-stepper';
import { LeadTagManager } from '@/features/leads/components/lead-tag-manager';
import { LeadWebsiteGap } from '@/features/leads/components/lead-website-gap';
import { WebsiteAnalysisPanel } from '@/features/leads/components/website-analysis-panel';
import { LeadCustomFieldsCard } from '@/features/custom-fields/lead-custom-fields-card';
import { SyncedCommunicationsCard } from '@/features/communications/synced-communications-card';
import { LeadWebsitesCard } from '@/features/leads/components/lead-websites-card';
import {
  isPrimarySitesPersona,
  isWonClientFile,
} from '@/features/organizations/professional-persona';
import {
  useAddLeadTags,
  useCreateActivity,
  useLead,
  useLeadActivities,
  useRemoveLeadTag,
  useUpdateLead,
} from '@/features/leads/hooks';
import { formatCategoryTag } from '@/features/opportunity-finder/format-category-tag';
import { fetchPipelines, moveLeadToStage } from '@/features/pipeline/api';
import { requestLeadWebsiteAnalysis } from '@/features/scoring/api';
import { fetchTasks } from '@/features/tasks/api';
import { useCreateTaskForLead, useUpdateTask } from '@/features/tasks/hooks';
import { getApiErrorMessage } from '@/lib/api';
import { formatLeadAddressLine } from '@/lib/format-lead-address';
import {
  buildGoogleMapsSearchUrl,
  buildGoogleWebSearchUrl,
  sanitizeExternalUrl,
  sanitizeMailtoHref,
  sanitizeTelHref,
} from '@/lib/safe-url';
import type { LeadStage, Task } from '@/types';
import { Role } from '@/types';
import { useAuthStore } from '@/stores/auth.store';

export function LeadDetailPage() {
  const { id = '' } = useParams();
  return <LeadDetailContent key={id} id={id} />;
}

function LeadDetailContent({ id }: { id: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const leadQuery = useLead(id);
  const activitiesQuery = useLeadActivities(id);
  const tasksQuery = useQuery({
    queryKey: ['tasks', { leadId: id }],
    queryFn: () => fetchTasks({ leadId: id, pageSize: 50 }),
    enabled: Boolean(id),
  });
  const pipelinesQuery = useQuery({
    queryKey: ['pipelines'],
    queryFn: fetchPipelines,
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [pipelineFeedback, setPipelineFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [addingEmail, setAddingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  const createActivity = useCreateActivity(id);
  const createTask = useCreateTaskForLead(id);
  const updateTask = useUpdateTask();
  const updateLead = useUpdateLead(id);
  const addTags = useAddLeadTags(id);
  const removeTag = useRemoveLeadTag(id);

  const analyzeMutation = useMutation({
    mutationFn: () => requestLeadWebsiteAnalysis(id),
    onSuccess: async () => {
      setAnalysisError(null);
      await leadQuery.refetch();
    },
    onError: (error) => {
      setAnalysisError(getApiErrorMessage(error));
    },
  });

  const moveStage = useMutation({
    mutationFn: async (stage: LeadStage) => {
      await moveLeadToStage(id, stage.id);
      return stage;
    },
    onSuccess: async (stage) => {
      setPipelineFeedback({
        tone: 'success',
        message: t('clientFile.stageMoved', { stage: stage.name }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['leads', id] }),
        queryClient.invalidateQueries({ queryKey: ['leads'] }),
        queryClient.invalidateQueries({ queryKey: ['leads', id, 'activities'] }),
        queryClient.invalidateQueries({ queryKey: ['pipeline'] }),
      ]);
    },
    onError: () => {
      setPipelineFeedback({
        tone: 'error',
        message: t('clientFile.stageError'),
      });
    },
  });

  const latestAnalysisStatus = leadQuery.data?.websiteRecord?.analyses?.[0]?.status;
  const analysisPending = latestAnalysisStatus === 'PENDING' || latestAnalysisStatus === 'RUNNING';

  useEffect(() => {
    if (analysisPending && analysisError) {
      setAnalysisError(null);
    }
  }, [analysisPending, analysisError]);

  useQuery({
    queryKey: [
      'leads',
      id,
      'analysis-poll',
      leadQuery.data?.websiteRecord?.analyses?.[0]?.id,
      latestAnalysisStatus,
    ],
    queryFn: async () => {
      await leadQuery.refetch();
      return true;
    },
    enabled: Boolean(id) && analysisPending,
    refetchInterval: analysisPending ? 2000 : false,
    refetchIntervalInBackground: false,
  });

  if (leadQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (leadQuery.isError || !leadQuery.data) {
    return (
      <div className="space-y-4">
        <Link to="/leads" className="inline-flex items-center gap-2 text-sm text-brand-400">
          <ArrowLeft className="h-4 w-4" /> {t('clientFile.back')}
        </Link>
        <p className="rounded-lg bg-red-500/10 p-4 text-sm text-red-300" role="alert">
          {t('clientFile.notFound')}
        </p>
      </div>
    );
  }

  const lead = leadQuery.data;
  const latestAnalysis = lead.websiteRecord?.analyses?.[0];
  const latestScore = lead.scores?.[0];
  const safeWebsite = lead.website ? sanitizeExternalUrl(lead.website) : null;
  const addressLine = formatLeadAddressLine({
    address: lead.address,
    city: lead.city,
    state: lead.state,
  });
  const mapsHref = addressLine ? buildGoogleMapsSearchUrl(addressLine) : null;
  const googleSearchHref = buildGoogleWebSearchUrl(
    [lead.companyName, lead.city].filter(Boolean).join(' '),
  );
  const telHref = sanitizeTelHref(lead.phone);
  const emailHref = sanitizeMailtoHref(lead.email);
  const whatsappRaw = lead.whatsapp?.trim() || lead.phone?.trim() || '';
  const whatsappMessage = buildWhatsAppOutreachMessage({
    companyName: lead.companyName,
    city: lead.city,
    recommendedAction: latestScore?.recommendedAction,
  });
  const contactBlocked = lead.doNotContact || lead.suppressed === true;
  const canWhatsApp = !contactBlocked && Boolean(sanitizeTelHref(whatsappRaw));
  const nextTask = tasksQuery.data?.data.find(
    (task) => task.status !== 'DONE' && task.status !== 'CANCELLED',
  );
  const nextStep = contactBlocked
    ? t('agents.whatsapp.doNotContactWarn')
    : (nextTask?.title ??
      (latestScore?.recommendedAction
        ? t(`scoreExplain.actions.${latestScore.recommendedAction}`)
        : t('clientFile.noNextStep')));
  const stages = orderedPipelineStages(pipelinesQuery.data);
  const funnelStages = stages.length > 0 ? stages : lead.stage ? [{ ...lead.stage, order: 0 }] : [];

  const outreachLead: WhatsAppOutreachModalLead = {
    id: lead.id,
    companyName: lead.companyName,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    stageId: lead.stage?.id,
    doNotContact: contactBlocked,
    context: nextStep,
    initialMessage: whatsappMessage,
  };

  const openWhatsApp = () => {
    if (canWhatsApp) setIsWhatsAppModalOpen(true);
  };

  const completeTask = async (task: Task) => {
    await updateTask.mutateAsync({ id: task.id, status: 'DONE' });
    await createActivity.mutateAsync({
      type: 'TASK',
      description: t('clientFile.taskCompleted', { title: task.title }),
    });
  };

  const activeStage = lead.stage ?? findStageForStatus(funnelStages, lead.status);
  const sitesPrimary = isPrimarySitesPersona(user?.effectivePersona);
  const sitesCard = (
    <LeadWebsitesCard
      leadId={lead.id}
      prominence={sitesPrimary ? 'primary' : 'secondary'}
      emphasized={isWonClientFile(lead)}
      canMutate={user?.role !== Role.VIEWER}
    />
  );

  return (
    <div className="space-y-6">
      <Link
        to="/leads"
        className="inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300"
      >
        <ArrowLeft className="h-4 w-4" /> {t('clientFile.back')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--ink)]">
            {t('clientFile.title')}
          </h1>
          <p className="text-sm text-[color:var(--ink-muted)]">
            {[
              lead.companyName,
              lead.segment ?? (lead.category ? formatCategoryTag(lead.category) : null),
              lead.city,
              lead.country,
            ]
              .filter(Boolean)
              .join(' · ') || 'Sem segmento'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {contactBlocked ? <Badge tone="red">{t('clientFile.blocked')}</Badge> : null}
          <Button
            onClick={openWhatsApp}
            disabled={!canWhatsApp}
            title={
              !canWhatsApp
                ? t(contactBlocked ? 'clientFile.blocked' : 'agents.whatsapp.noPhone')
                : undefined
            }
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            {t('clientFile.callWhatsApp')}
          </Button>
        </div>
      </div>

      <LeadStatusStepper
        status={lead.status}
        pending={updateLead.isPending || user?.role === Role.VIEWER}
        onSelect={(status) => {
          setSaveError(null);
          void updateLead
            .mutateAsync({ status })
            .catch(() => setSaveError(t('clientFile.saveError')));
        }}
      />
      {saveError ? <Alert tone="error" title={saveError} /> : null}
      <details className="rounded-card border border-[color:var(--border)] p-4">
        <summary className="cursor-pointer text-sm text-[color:var(--ink-muted)]">
          {t('clientFile.pipeline')}
        </summary>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {pipelinesQuery.isLoading ? (
            <Skeleton className="h-9 w-full max-w-xl" />
          ) : (
            <LeadPipelineStepper
              stages={funnelStages}
              currentStageId={activeStage?.id}
              pending={moveStage.isPending}
              onSelect={(stage) => {
                setPipelineFeedback(null);
                moveStage.mutate(stage);
              }}
            />
          )}
          {lead.stage ? (
            <Button size="sm" variant="ghost" onClick={() => navigate('/pipeline')}>
              <Workflow className="h-4 w-4" aria-hidden />
              {t('clientFile.viewPipeline')}
            </Button>
          ) : null}
        </div>
      </details>

      {pipelineFeedback ? (
        <Alert tone={pipelineFeedback.tone} title={pipelineFeedback.message} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader title={t('clientFile.information')} />
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase text-[color:var(--ink-muted)]">
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  {t('clientFile.phone')}
                </p>
                <p className="text-[color:var(--ink)]">{lead.phone ?? '—'}</p>
                {lead.phone ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {telHref ? (
                      <a
                        href={telHref}
                        className="inline-flex h-8 items-center gap-1 rounded-control border border-[color:var(--border)] px-2 text-xs font-medium text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--ink)]"
                      >
                        {t('clientFile.call')}
                      </a>
                    ) : null}
                    {canWhatsApp ? (
                      <button
                        type="button"
                        onClick={openWhatsApp}
                        className="inline-flex h-8 items-center gap-1 rounded-control border border-[color:var(--border)] px-2 text-xs font-medium text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--ink)]"
                      >
                        WhatsApp
                      </button>
                    ) : null}
                    <CopyButton value={lead.phone} label={t('clientFile.copyPhone')} />
                  </div>
                ) : null}
              </div>

              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase text-[color:var(--ink-muted)]">
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  {t('clientFile.email')}
                </p>
                {lead.email ? (
                  <>
                    <p className="break-all text-[color:var(--ink)]">{lead.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {emailHref ? (
                        <a
                          href={emailHref}
                          className="inline-flex h-8 items-center gap-1 rounded-control border border-[color:var(--border)] px-2 text-xs font-medium text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--ink)]"
                        >
                          {t('clientFile.send')}
                        </a>
                      ) : null}
                      <CopyButton value={lead.email} label={t('clientFile.copyEmail')} />
                    </div>
                  </>
                ) : addingEmail ? (
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const href = sanitizeMailtoHref(emailDraft);
                      if (!href) return;
                      void updateLead.mutateAsync({ email: emailDraft.trim() }).then(() => {
                        setAddingEmail(false);
                        setEmailDraft('');
                      });
                    }}
                  >
                    <Input
                      value={emailDraft}
                      onChange={(event) => setEmailDraft(event.target.value)}
                      placeholder="contato@empresa.com"
                      aria-label={t('clientFile.newEmail')}
                      type="email"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      loading={updateLead.isPending}
                    >
                      {t('clientFile.save')}
                    </Button>
                  </form>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setAddingEmail(true)}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    {t('clientFile.addEmail')}
                  </Button>
                )}
              </div>

              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase text-[color:var(--ink-muted)]">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {t('clientFile.address')}
                </p>
                <p className="text-[color:var(--ink)]">{addressLine ?? '—'}</p>
                {addressLine ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {mapsHref ? (
                      <a
                        href={mapsHref}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex h-8 items-center gap-1 rounded-control border border-[color:var(--border)] px-2 text-xs font-medium text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--ink)]"
                      >
                        Google Maps
                      </a>
                    ) : null}
                    <CopyButton value={addressLine} label={t('clientFile.copyAddress')} />
                  </div>
                ) : null}
              </div>

              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase text-[color:var(--ink-muted)]">
                  <Globe className="h-3.5 w-3.5" aria-hidden />
                  {t('clientFile.website')}
                </p>
                {safeWebsite ? (
                  <>
                    <a
                      href={safeWebsite}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-brand-400 hover:underline"
                    >
                      {lead.website}
                    </a>
                  </>
                ) : (
                  <LeadWebsiteGap
                    companyName={lead.companyName}
                    city={lead.city}
                    category={lead.category}
                    segment={lead.segment}
                    googleHref={googleSearchHref}
                    pending={updateLead.isPending}
                    onSaveUrl={(url) => {
                      void updateLead.mutateAsync({ website: url });
                    }}
                  />
                )}
              </div>

              <div>
                <p className="text-xs text-[color:var(--ink-muted)]">{t('clientFile.category')}</p>
                <p>{lead.segment || (lead.category ? formatCategoryTag(lead.category) : '—')}</p>
              </div>
              <div>
                <p className="text-xs text-[color:var(--ink-muted)]">{t('clientFile.source')}</p>
                <p>{t(`reports.sources.${lead.source}`, { defaultValue: lead.source })}</p>
              </div>
              <div>
                <p className="text-xs text-[color:var(--ink-muted)]">
                  {t('clientFile.opportunityScore')}
                </p>
                <ScoreBadge score={latestScore?.score ?? lead.score} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title={t('clientFile.nextStep')} />
            <CardContent className="space-y-3">
              <p className="text-sm text-[color:var(--ink)]">{nextStep}</p>
              <Button
                variant="outline"
                onClick={() =>
                  document.getElementById('client-activity')?.scrollIntoView({ block: 'start' })
                }
              >
                {t('clientFile.manageTasks')}
              </Button>
              <Button variant="ghost" onClick={() => navigate(`/agents/crm?leadId=${lead.id}`)}>
                {t('clientFile.crm')}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title={t('clientFile.notesTags')} />
            <CardContent className="space-y-4">
              <LeadTagManager
                tags={lead.tags}
                pending={addTags.isPending || removeTag.isPending}
                onAdd={(name) => {
                  void addTags.mutateAsync([name]);
                }}
                onRemove={(tagId) => {
                  void removeTag.mutateAsync(tagId);
                }}
              />
              <Textarea
                label={t('clientFile.notes')}
                value={notesDraft ?? lead.notes ?? ''}
                disabled={user?.role === Role.VIEWER}
                onChange={(event) => setNotesDraft(event.target.value)}
              />
              {user?.role !== Role.VIEWER ? (
                <Button
                  variant="outline"
                  loading={updateLead.isPending}
                  disabled={notesDraft === null}
                  onClick={() => {
                    setSaveError(null);
                    void updateLead
                      .mutateAsync({ notes: notesDraft ?? '' })
                      .then(() => setNotesDraft(null))
                      .catch(() => setSaveError(t('clientFile.saveError')));
                  }}
                >
                  {t('clientFile.saveNotes')}
                </Button>
              ) : null}
            </CardContent>
          </Card>
          <LeadCustomFieldsCard leadId={lead.id} values={lead.customFieldValues} />
        </div>

        <div className="space-y-4 lg:col-span-2">
          {sitesPrimary ? sitesCard : null}
          {lead.website ? (
            <Card>
              <CardHeader
                title={t('clientFile.websiteAnalysis')}
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    loading={analyzeMutation.isPending || analysisPending}
                    onClick={() => {
                      setAnalysisError(null);
                      analyzeMutation.mutate();
                    }}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    {t('clientFile.reanalyze')}
                  </Button>
                }
              />
              <CardContent>
                <WebsiteAnalysisPanel
                  hasWebsite
                  analysis={latestAnalysis}
                  errorMessage={analysisError}
                />
              </CardContent>
            </Card>
          ) : null}

          {sitesPrimary ? null : sitesCard}

          <SyncedCommunicationsCard leadId={lead.id} />

          <div id="client-activity">
            <LeadActivityHub
              activities={activitiesQuery.data?.data ?? []}
              activitiesLoading={activitiesQuery.isLoading}
              tasks={tasksQuery.data?.data ?? []}
              tasksLoading={tasksQuery.isLoading}
              activityPending={createActivity.isPending}
              taskPending={createTask.isPending || updateTask.isPending}
              onLogActivity={(input) => createActivity.mutateAsync(input)}
              onCreateTask={(input) => createTask.mutateAsync(input)}
              onCompleteTask={completeTask}
            />
          </div>
        </div>
      </div>

      <WhatsAppOutreachModal
        lead={outreachLead}
        stages={funnelStages}
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
      />
    </div>
  );
}

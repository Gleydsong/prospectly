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
import { useNavigate, useParams, Link } from 'react-router-dom';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LeadActivityHub } from '@/features/leads/components/lead-activity-hub';
import {
  buildWhatsAppHref,
  buildWhatsAppOutreachMessage,
} from '@/features/leads/components/lead-contact-channels';
import {
  CrmCopilotCard,
  WhatsAppOutreachModal,
  type WhatsAppOutreachModalLead,
} from '@/features/agents/components';
import { CopyButton } from '@/features/leads/components/lead-copy-button';
import { LeadOpportunityCard } from '@/features/leads/components/lead-opportunity-card';
import { LeadOriginAudit } from '@/features/leads/components/lead-origin-audit';
import {
  LeadPipelineStepper,
  orderedPipelineStages,
} from '@/features/leads/components/lead-pipeline-stepper';
import { LeadTagManager } from '@/features/leads/components/lead-tag-manager';
import { LeadWebsiteGap } from '@/features/leads/components/lead-website-gap';
import { WebsiteAnalysisPanel } from '@/features/leads/components/website-analysis-panel';
import { LeadCustomFieldsCard } from '@/features/custom-fields/lead-custom-fields-card';
import { SyncedCommunicationsCard } from '@/features/communications/synced-communications-card';
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
import { formatDateTime } from '@/lib/utils';
import type { LeadStage, Task } from '@/types';

export function LeadDetailPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id = '' } = useParams();
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
        message: `Cliente potencial movido para a etapa “${stage.name}” do funil.`,
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
        message: 'Não foi possível atualizar a etapa do funil.',
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
          <ArrowLeft className="h-4 w-4" /> Voltar para clientes
        </Link>
        <p className="rounded-lg bg-red-500/10 p-4 text-sm text-red-300" role="alert">
          Cliente potencial não encontrado ou sem permissão de acesso.
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
  const whatsappHref =
    !lead.doNotContact && whatsappRaw ? buildWhatsAppHref(whatsappRaw, whatsappMessage) : null;
  const stages = orderedPipelineStages(pipelinesQuery.data);
  const funnelStages = stages.length > 0 ? stages : lead.stage ? [{ ...lead.stage, order: 0 }] : [];

  const outreachLead: WhatsAppOutreachModalLead = {
    id: lead.id,
    companyName: lead.companyName,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    stageId: lead.stage?.id,
    doNotContact: lead.doNotContact,
  };

  const openWhatsApp = () => {
    setIsWhatsAppModalOpen(true);
  };

  const completeTask = async (task: Task) => {
    await updateTask.mutateAsync({ id: task.id, status: 'DONE' });
    await createActivity.mutateAsync({
      type: 'TASK',
      description: `Tarefa concluída: ${task.title}`,
    });
  };

  return (
    <div className="space-y-5">
      <Link
        to="/leads"
        className="inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para clientes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--ink)]">
            {lead.companyName}
          </h1>
          <p className="text-sm text-[color:var(--ink-muted)]">
            {[
              lead.segment ?? (lead.category ? formatCategoryTag(lead.category) : null),
              lead.city,
              lead.country,
            ]
              .filter(Boolean)
              .join(' · ') || 'Sem segmento'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LeadStatusBadge status={lead.status} />
          <ScoreBadge score={lead.score} />
          {lead.doNotContact ? <Badge tone="red">Não contatar</Badge> : null}
          {whatsappRaw ? (
            <Button size="sm" onClick={openWhatsApp}>
              <MessageCircle className="h-4 w-4" aria-hidden />
              Chamar no WhatsApp
            </Button>
          ) : (
            <Button size="sm" disabled title="Telefone/WhatsApp não cadastrado">
              <MessageCircle className="h-4 w-4" aria-hidden />
              Chamar no WhatsApp
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/agents/crm?leadId=${lead.id}`)}
          >
            Assistente de CRM
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsWhatsAppModalOpen(true)}
          >
            Abordagem
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {pipelinesQuery.isLoading ? (
          <Skeleton className="h-9 w-full max-w-xl" />
        ) : (
          <LeadPipelineStepper
            stages={funnelStages}
            currentStageId={lead.stage?.id}
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
            Ver no funil
          </Button>
        ) : null}
      </div>

      {pipelineFeedback ? (
        <Alert tone={pipelineFeedback.tone} title={pipelineFeedback.message} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
          <CardHeader title="Informações" />
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase text-[color:var(--ink-muted)]">
                <Phone className="h-3.5 w-3.5" aria-hidden />
                Telefone
              </p>
              <p className="text-[color:var(--ink)]">{lead.phone ?? '—'}</p>
              {lead.phone ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {telHref ? (
                    <a
                      href={telHref}
                      className="inline-flex h-8 items-center gap-1 rounded-control border border-[color:var(--border)] px-2 text-xs font-medium text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--ink)]"
                    >
                      Ligar
                    </a>
                  ) : null}
                  {whatsappHref ? (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex h-8 items-center gap-1 rounded-control border border-[color:var(--border)] px-2 text-xs font-medium text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--ink)]"
                    >
                      WhatsApp
                    </a>
                  ) : null}
                  <CopyButton value={lead.phone} label="Copiar telefone" />
                </div>
              ) : null}
            </div>

            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase text-[color:var(--ink-muted)]">
                <Mail className="h-3.5 w-3.5" aria-hidden />
                E-mail
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
                        Enviar
                      </a>
                    ) : null}
                    <CopyButton value={lead.email} label="Copiar e-mail" />
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
                    aria-label="Novo e-mail"
                    type="email"
                  />
                  <Button type="submit" size="sm" loading={updateLead.isPending}>
                    Salvar
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
                  Adicionar e-mail
                </Button>
              )}
            </div>

            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase text-[color:var(--ink-muted)]">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                Endereço
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
                  <CopyButton value={addressLine} label="Copiar endereço" />
                </div>
              ) : null}
            </div>

            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase text-[color:var(--ink-muted)]">
                <Globe className="h-3.5 w-3.5" aria-hidden />
                Site
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
                  <div className="mt-2">
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
                      Verificar site
                    </Button>
                  </div>
                </>
              ) : (
                <LeadWebsiteGap
                  companyName={lead.companyName}
                  city={lead.city}
                  googleHref={googleSearchHref}
                  pending={updateLead.isPending}
                  onSaveUrl={(url) => {
                    void updateLead.mutateAsync({ website: url });
                  }}
                />
              )}
            </div>

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

            {lead.notes ? (
              <div>
                <p className="mb-1 text-xs font-medium uppercase text-[color:var(--ink-muted)]">
                  Observações
                </p>
                <p className="whitespace-pre-wrap text-[color:var(--ink)]">{lead.notes}</p>
              </div>
            ) : null}

            <LeadOriginAudit>
              <dl className="space-y-2 text-sm text-[color:var(--ink)]">
                <div className="flex justify-between gap-3">
                  <dt className="text-[color:var(--ink-muted)]">Fonte</dt>
                  <dd>{SOURCE_LABEL[lead.source] ?? 'Outra fonte'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[color:var(--ink-muted)]">Coletado em</dt>
                  <dd>{lead.dataCollectedAt ? formatDateTime(lead.dataCollectedAt) : '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[color:var(--ink-muted)]">Última verificação</dt>
                  <dd>{lead.lastVerifiedAt ? formatDateTime(lead.lastVerifiedAt) : '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[color:var(--ink-muted)]">Confiança</dt>
                  <dd>{lead.confidenceLevel ? CONFIDENCE_LABEL[lead.confidenceLevel] : '—'}</dd>
                </div>
              </dl>
              {lead.missingFields &&
              lead.missingFields.filter((field) => !CONTACT_MISSING_FIELDS.has(field)).length >
                0 ? (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium uppercase text-[color:var(--ink-muted)]">
                    Dados ausentes
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {lead.missingFields
                      .filter((field) => !CONTACT_MISSING_FIELDS.has(field))
                      .map((field) => (
                        <Badge key={field} tone="amber">
                          {MISSING_FIELD_LABEL[field] ?? field}
                        </Badge>
                      ))}
                  </div>
                </div>
              ) : null}
            </LeadOriginAudit>
          </CardContent>
        </Card>

          <LeadCustomFieldsCard leadId={lead.id} values={lead.customFieldValues} />
        </div>

        <div className="space-y-4 lg:col-span-2">
          <CrmCopilotCard
            leadId={lead.id}
            onOpenWhatsApp={whatsappRaw && !lead.doNotContact ? openWhatsApp : undefined}
          />

          <LeadOpportunityCard
            score={lead.score}
            snapshot={latestScore}
            blocked={lead.doNotContact}
            onWhatsApp={whatsappHref ? openWhatsApp : undefined}
            onCrm={() => navigate(`/agents/crm?leadId=${lead.id}`)}
          />

          {lead.website ? (
            <Card>
              <CardHeader
                title="Análise do site"
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
                    Reanalisar
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

          <SyncedCommunicationsCard leadId={lead.id} />

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

      <WhatsAppOutreachModal
        lead={outreachLead}
        stages={funnelStages}
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
      />
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: 'Manual',
  CSV_IMPORT: 'Importação CSV',
  GOOGLE_PLACES: 'Google Places',
  OPENSTREETMAP: 'OpenStreetMap',
  YELP: 'Yelp',
  REFERRAL: 'Indicação',
  OTHER: 'Outro',
};

const CONFIDENCE_LABEL: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
};

const MISSING_FIELD_LABEL: Record<string, string> = {
  phone: 'Telefone',
  email: 'E-mail',
  website: 'Site',
  whatsapp: 'WhatsApp',
  address: 'Endereço',
  city: 'Cidade',
  category: 'Categoria',
};

const CONTACT_MISSING_FIELDS = new Set(['email', 'website', 'whatsapp', 'phone']);

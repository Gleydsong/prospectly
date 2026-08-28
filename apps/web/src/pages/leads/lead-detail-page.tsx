import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Globe, Mail, MapPin, Phone, RefreshCw, Workflow } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { Modal } from '@/components/ui/modal';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useCreateActivity, useLead, useLeadActivities } from '@/features/leads/hooks';
import { LeadContactChannels } from '@/features/leads/components/lead-contact-channels';
import { WebsiteAnalysisPanel } from '@/features/leads/components/website-analysis-panel';
import { formatCategoryTag } from '@/features/opportunity-finder/format-category-tag';
import { fetchPipelines, moveLeadToStage } from '@/features/pipeline/api';
import { selectInitialPipelineStage } from '@/features/pipeline/select-initial-stage';
import { requestLeadWebsiteAnalysis } from '@/features/scoring/api';
import { fetchTasks } from '@/features/tasks/api';
import { useCreateTaskForLead } from '@/features/tasks/hooks';
import { getApiErrorMessage } from '@/lib/api';
import { formatLeadAddressLine } from '@/lib/format-lead-address';
import { TASK_STATUS_LABELS, formatActivityType } from '@/lib/presentation-labels';
import { sanitizeExternalUrl } from '@/lib/safe-url';
import { formatDateTime } from '@/lib/utils';

const activitySchema = z.object({
  type: z.string().min(1, 'Tipo obrigatório'),
  description: z.string().optional(),
  outcome: z.string().optional(),
});

const taskSchema = z.object({
  title: z.string().min(2, 'Título obrigatório'),
  dueAt: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

const ACTIVITY_TYPES = [
  { value: 'CALL', label: 'Ligação' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'MEETING', label: 'Reunião' },
  { value: 'NOTE', label: 'Nota' },
];

export function LeadDetailPage() {
  const { t } = useTranslation();
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
    enabled: Boolean(id) && Boolean(leadQuery.data) && !leadQuery.data?.stage,
    staleTime: 60_000,
  });

  const [activityOpen, setActivityOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [pipelineFeedback, setPipelineFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const createActivity = useCreateActivity(id);
  const createTask = useCreateTaskForLead(id);
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
  const sendToPipeline = useMutation({
    mutationFn: async () => {
      const pipelines = pipelinesQuery.data ?? (await fetchPipelines());
      const initialStage = selectInitialPipelineStage(pipelines);
      if (!initialStage) {
        throw new Error('PIPELINE_STAGE_NOT_AVAILABLE');
      }
      await moveLeadToStage(id, initialStage.id);
      return initialStage;
    },
    onSuccess: async (stage) => {
      setPipelineFeedback({
        tone: 'success',
        message: `Cliente potencial adicionado à etapa “${stage.name}” do funil.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['leads', id] }),
        queryClient.invalidateQueries({ queryKey: ['leads'] }),
        queryClient.invalidateQueries({ queryKey: ['pipeline'] }),
      ]);
    },
    onError: (error) => {
      setPipelineFeedback({
        tone: 'error',
        message:
          error instanceof Error && error.message === 'PIPELINE_STAGE_NOT_AVAILABLE'
            ? 'O funil ainda não possui uma etapa disponível.'
            : 'Não foi possível enviar o cliente potencial para o funil.',
      });
    },
  });

  const activityForm = useForm<z.infer<typeof activitySchema>>({
    resolver: zodResolver(activitySchema),
    defaultValues: { type: 'NOTE' },
  });
  const taskForm = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: 'MEDIUM' },
  });

  const latestAnalysisStatus = leadQuery.data?.websiteRecord?.analyses?.[0]?.status;
  const analysisPending =
    latestAnalysisStatus === 'PENDING' || latestAnalysisStatus === 'RUNNING';

  useEffect(() => {
    if (analysisPending && analysisError) {
      setAnalysisError(null);
    }
  }, [analysisPending, analysisError]);

  // Poll enquanto a análise está na fila/rodando (worker BullMQ).
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

  return (
    <div className="space-y-5">
      <Link to="/leads" className="inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300">
        <ArrowLeft className="h-4 w-4" /> Voltar para clientes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--ink)]">{lead.companyName}</h1>
          <p className="text-sm text-[color:var(--ink-muted)]">
            {[
              lead.segment ?? (lead.category ? formatCategoryTag(lead.category) : null),
              lead.city,
              lead.country,
            ].filter(Boolean).join(' · ') || 'Sem segmento'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LeadStatusBadge status={lead.status} />
          <ScoreBadge score={lead.score} />
          {lead.doNotContact ? <Badge tone="red">Não contatar</Badge> : null}
          {lead.stage ? (
            <Button size="sm" onClick={() => navigate('/pipeline')}>
              <Workflow className="h-4 w-4" aria-hidden />
              Ver no funil
            </Button>
          ) : (
            <Button
              size="sm"
              loading={pipelinesQuery.isLoading || sendToPipeline.isPending}
              onClick={() => {
                setPipelineFeedback(null);
                sendToPipeline.mutate();
              }}
            >
              <Workflow className="h-4 w-4" aria-hidden />
              Enviar para o funil
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => navigate(`/agents/crm?leadId=${lead.id}`)}>
            Assistente de CRM
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/agents/whatsapp?leadId=${lead.id}`)}
          >
            1ª mensagem WhatsApp
          </Button>
        </div>
      </div>

      {pipelineFeedback ? (
        <Alert tone={pipelineFeedback.tone} title={pipelineFeedback.message} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Informações" />
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={Phone} label="Telefone" value={lead.phone} />
            <InfoRow icon={Mail} label="E-mail" value={lead.email} />
            <InfoRow
              icon={Globe}
              label="Site"
              value={
                safeWebsite ? (
                  <a
                    href={safeWebsite}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-brand-400 hover:underline"
                  >
                    {lead.website}
                  </a>
                ) : lead.website ? (
                  lead.website
                ) : (
                  websitePresenceLabel(lead.websitePresence)
                )
              }
            />
            <InfoRow
              icon={MapPin}
              label="Endereço"
              value={formatLeadAddressLine({
                address: lead.address,
                city: lead.city,
                state: lead.state,
              })}
            />
            <div className="pt-2">
              <p className="mb-1 text-xs font-medium uppercase text-[color:var(--ink-muted)]">Etiquetas</p>
              <div className="flex flex-wrap gap-1">
                {lead.tags.length === 0 ? (
                  <span className="text-[color:var(--ink-muted)]">—</span>
                ) : (
                  lead.tags.map((tag) => <Badge key={tag.id}>{tag.name}</Badge>)
                )}
              </div>
            </div>
            {lead.notes ? (
              <div className="pt-2">
                <p className="mb-1 text-xs font-medium uppercase text-[color:var(--ink-muted)]">Observações</p>
                <p className="whitespace-pre-wrap text-[color:var(--ink)]">{lead.notes}</p>
              </div>
            ) : null}

            <div className="border-t border-[color:var(--border)] pt-3">
              <p className="mb-2 text-xs font-medium uppercase text-[color:var(--ink-muted)]">Origem</p>
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
                <div className="flex justify-between gap-3">
                  <dt className="text-[color:var(--ink-muted)]">Site (fonte)</dt>
                  <dd>{websitePresenceLabel(lead.websitePresence)}</dd>
                </div>
                {lead.websiteStatusReason ? (
                  <p className="text-xs text-[color:var(--ink-muted)]">{lead.websiteStatusReason}</p>
                ) : null}
              </dl>
              <LeadContactChannels
                lead={{
                  companyName: lead.companyName,
                  email: lead.email,
                  website: lead.website,
                  phone: lead.phone,
                  whatsapp: lead.whatsapp,
                  city: lead.city,
                  doNotContact: lead.doNotContact,
                  recommendedAction: lead.scores?.[0]?.recommendedAction,
                }}
              />
              {lead.missingFields &&
              lead.missingFields.filter((field) => !CONTACT_MISSING_FIELDS.has(field)).length >
                0 ? (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium uppercase text-[color:var(--ink-muted)]">Dados ausentes</p>
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
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  loading={analyzeMutation.isPending || analysisPending}
                  onClick={() => {
                    setAnalysisError(null);
                    analyzeMutation.mutate();
                  }}
                  disabled={!lead.website}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  {lead.website ? 'Verificar site' : 'Verificar (precisa de site)'}
                </Button>
                {!lead.website ? (
                  <p className="mt-2 text-xs text-[color:var(--ink-muted)]">
                    Sem URL cadastrada não dá para checar o site automaticamente.
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Pontuação de oportunidade"
              action={<ScoreBadge score={lead.score} />}
            />
            <CardContent>
              {latestScore ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <DimensionStat
                      label={t('scoreExplain.fit', { defaultValue: 'Aderência' })}
                      value={latestScore.fit ?? 0}
                    />
                    <DimensionStat
                      label={t('scoreExplain.opportunity', { defaultValue: 'Oportunidade' })}
                      value={latestScore.opportunity ?? 0}
                    />
                    <DimensionStat
                      label={t('scoreExplain.engagement', { defaultValue: 'Engajamento' })}
                      value={latestScore.engagement ?? 0}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase text-[color:var(--ink-muted)]">
                        {t('scoreExplain.recommendedAction', { defaultValue: 'Ação recomendada' })}
                      </p>
                      <p className="text-sm text-[color:var(--ink)]">
                        {t(`scoreExplain.actions.${latestScore.recommendedAction ?? 'NURTURE'}`, {
                          defaultValue: latestScore.recommendedAction ?? 'NURTURE',
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase text-[color:var(--ink-muted)]">
                        {t('scoreExplain.configVersion', { defaultValue: 'Versão da configuração' })}
                      </p>
                      <p className="text-sm text-[color:var(--ink)]">v{latestScore.configVersion}</p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-[color:var(--ink-muted)]">
                      {t('scoreExplain.appliedRules', { defaultValue: 'Regras aplicadas' })}
                    </p>
                    <ul className="space-y-1 text-sm text-[color:var(--ink)]">
                      {(latestScore.rulesApplied as Array<{
                        key: string;
                        points: number;
                        dimension?: string;
                      }>).map((rule) => (
                        <li key={rule.key} className="flex justify-between gap-3">
                          <span>
                            {t(`scoreRules.${rule.key}`, { defaultValue: rule.key })}
                            {rule.dimension ? (
                              <span className="ml-2 text-xs text-[color:var(--ink-muted)]">
                                ({t(`scoreExplain.${rule.dimension}`, { defaultValue: rule.dimension })})
                              </span>
                            ) : null}
                          </span>
                          <span className="font-medium">+{rule.points}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-[color:var(--ink-muted)]">
                      {t('scoreExplain.missingData', { defaultValue: 'Dados ausentes' })}
                    </p>
                    {(latestScore.missingData ?? []).length === 0 ? (
                      <p className="text-sm text-[color:var(--ink-muted)]">—</p>
                    ) : (
                      <ul className="flex flex-wrap gap-1.5">
                        {(latestScore.missingData ?? []).map((field) => (
                          <Badge key={field} tone="amber">
                            {t(`scoreExplain.missing.${field}`, { defaultValue: field })}
                          </Badge>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[color:var(--ink-muted)]">
                  A pontuação detalhada aparece após a primeira análise ou recálculo.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Análise do site"
              action={
                lead.website ? (
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
                ) : undefined
              }
            />
            <CardContent>
              <WebsiteAnalysisPanel
                hasWebsite={Boolean(lead.website)}
                analysis={latestAnalysis}
                errorMessage={analysisError}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Atividades"
              action={
                <Button size="sm" variant="outline" onClick={() => setActivityOpen(true)}>
                  Registrar atividade
                </Button>
              }
            />
            <CardContent>
              {activitiesQuery.isLoading ? (
                <Skeleton className="h-24" />
              ) : !activitiesQuery.data || activitiesQuery.data.data.length === 0 ? (
                <p className="text-sm text-[color:var(--ink-muted)]">Nenhuma atividade registrada.</p>
              ) : (
                <ol className="relative space-y-4 border-l border-[color:var(--border)] pl-5">
                  {activitiesQuery.data.data.map((activity) => (
                    <li key={activity.id} className="relative">
                      <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-brand-500" aria-hidden />
                      <p className="text-sm font-medium text-[color:var(--ink)]">{formatActivityType(activity.type)}</p>
                      {activity.description ? (
                        <p className="text-sm text-[color:var(--ink)]">{activity.description}</p>
                      ) : null}
                      <p className="text-xs text-[color:var(--ink-muted)]">
                        {activity.user.name} · {formatDateTime(activity.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Tarefas"
              action={
                <Button size="sm" variant="outline" onClick={() => setTaskOpen(true)}>
                  Nova tarefa
                </Button>
              }
            />
            <CardContent>
              {tasksQuery.isLoading ? (
                <Skeleton className="h-20" />
              ) : !tasksQuery.data || tasksQuery.data.data.length === 0 ? (
                <p className="text-sm text-[color:var(--ink-muted)]">Nenhuma tarefa.</p>
              ) : (
                <ul className="space-y-2">
                  {tasksQuery.data.data.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between rounded-lg border border-[color:var(--border)] p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[color:var(--ink)]">{task.title}</p>
                        <p className="text-xs text-[color:var(--ink-muted)]">
                          {task.assignee?.name ?? 'Sem responsável'} · {formatDateTime(task.dueAt)}
                        </p>
                      </div>
                      <Badge tone={task.status === 'DONE' ? 'green' : task.priority === 'HIGH' ? 'red' : 'slate'}>
                        {TASK_STATUS_LABELS[task.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal open={activityOpen} onClose={() => setActivityOpen(false)} title="Registrar atividade">
        <form
          onSubmit={activityForm.handleSubmit(async (values) => {
            await createActivity.mutateAsync(values);
            activityForm.reset({ type: 'NOTE' });
            setActivityOpen(false);
          })}
          className="space-y-4"
        >
          <Select label="Tipo" error={activityForm.formState.errors.type?.message} {...activityForm.register('type')}>
            {ACTIVITY_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Textarea label="Descrição" {...activityForm.register('description')} />
          <Input label="Resultado" {...activityForm.register('outcome')} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setActivityOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={createActivity.isPending}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={taskOpen} onClose={() => setTaskOpen(false)} title="Nova tarefa">
        <form
          onSubmit={taskForm.handleSubmit(async (values) => {
            await createTask.mutateAsync({
              title: values.title,
              dueAt: values.dueAt || undefined,
              priority: values.priority,
            });
            taskForm.reset({ priority: 'MEDIUM' });
            setTaskOpen(false);
          })}
          className="space-y-4"
        >
          <Input label="Título" error={taskForm.formState.errors.title?.message} {...taskForm.register('title')} />
          <Input label="Vencimento" type="date" {...taskForm.register('dueAt')} />
          <Select label="Prioridade" {...taskForm.register('priority')}>
            <option value="LOW">Baixa</option>
            <option value="MEDIUM">Média</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </Select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setTaskOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={createTask.isPending}>
              Criar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}


function DimensionStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[color:var(--ink)]">{value}</p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 text-[color:var(--ink-muted)]" aria-hidden />
      <div>
        <p className="text-xs font-medium uppercase text-[color:var(--ink-muted)]">{label}</p>
        <p className="text-[color:var(--ink)]">{value ?? '—'}</p>
      </div>
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

function websitePresenceLabel(presence?: string | null): string {
  switch (presence) {
    case 'NO_WEBSITE_REPORTED':
      return 'Fonte não informou site';
    case 'WEBSITE_FOUND':
      return 'Site informado pela fonte';
    case 'NEEDS_REVIEW':
      return 'Revisão do site necessária';
    default:
      return 'Site não cadastrado';
  }
}

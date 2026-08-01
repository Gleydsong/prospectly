import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Globe, Mail, MapPin, Phone, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
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
import { requestLeadWebsiteAnalysis } from '@/features/scoring/api';
import { fetchTasks } from '@/features/tasks/api';
import { useCreateTaskForLead } from '@/features/tasks/hooks';
import { getApiErrorMessage } from '@/lib/api';
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
  const { id = '' } = useParams();
  const leadQuery = useLead(id);
  const activitiesQuery = useLeadActivities(id);
  const tasksQuery = useQuery({
    queryKey: ['tasks', { leadId: id }],
    queryFn: () => fetchTasks({ leadId: id, pageSize: 50 }),
    enabled: Boolean(id),
  });

  const [activityOpen, setActivityOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);

  const createActivity = useCreateActivity(id);
  const createTask = useCreateTaskForLead(id);
  const analyzeMutation = useMutation({
    mutationFn: () => requestLeadWebsiteAnalysis(id),
    onSuccess: async () => {
      setAnalysisMessage(t('leads.analysisQueued', { defaultValue: 'Análise enfileirada.' }));
      await leadQuery.refetch();
      window.setTimeout(() => {
        void leadQuery.refetch();
      }, 2500);
    },
    onError: (error) => {
      setAnalysisMessage(getApiErrorMessage(error));
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
          <ArrowLeft className="h-4 w-4" /> Voltar para leads
        </Link>
        <p className="rounded-lg bg-red-500/10 p-4 text-sm text-red-300" role="alert">
          Lead não encontrado ou sem permissão de acesso.
        </p>
      </div>
    );
  }

  const lead = leadQuery.data;
  const latestAnalysis = lead.websiteRecord?.analyses?.[0];
  const latestScore = lead.scores?.[0];
  const safeWebsite = lead.website ? sanitizeExternalUrl(lead.website) : null;
  const analysisPending =
    latestAnalysis?.status === 'PENDING' || latestAnalysis?.status === 'RUNNING';

  return (
    <div className="space-y-5">
      <Link to="/leads" className="inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300">
        <ArrowLeft className="h-4 w-4" /> Voltar para leads
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{lead.companyName}</h1>
          <p className="text-sm text-zinc-500">
            {[lead.segment, lead.city, lead.country].filter(Boolean).join(' · ') || 'Sem segmento'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LeadStatusBadge status={lead.status} />
          <ScoreBadge score={lead.score} />
          {lead.doNotContact ? <Badge tone="red">Não contatar</Badge> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Informações" />
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={Phone} label="Telefone" value={lead.phone} />
            <InfoRow icon={Mail} label="E-mail" value={lead.email} />
            <InfoRow
              icon={Globe}
              label="Website"
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
            <InfoRow icon={MapPin} label="Endereço" value={[lead.address, lead.city, lead.state].filter(Boolean).join(', ') || undefined} />
            <div className="pt-2">
              <p className="mb-1 text-xs font-medium uppercase text-zinc-400">Tags</p>
              <div className="flex flex-wrap gap-1">
                {lead.tags.length === 0 ? (
                  <span className="text-zinc-400">—</span>
                ) : (
                  lead.tags.map((tag) => <Badge key={tag.id}>{tag.name}</Badge>)
                )}
              </div>
            </div>
            {lead.notes ? (
              <div className="pt-2">
                <p className="mb-1 text-xs font-medium uppercase text-zinc-400">Observações</p>
                <p className="whitespace-pre-wrap text-zinc-300">{lead.notes}</p>
              </div>
            ) : null}

            <div className="border-t border-zinc-800 pt-3">
              <p className="mb-2 text-xs font-medium uppercase text-zinc-400">Proveniência</p>
              <dl className="space-y-2 text-sm text-zinc-300">
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Fonte</dt>
                  <dd>{SOURCE_LABEL[lead.source] ?? lead.source}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Coletado em</dt>
                  <dd>{lead.dataCollectedAt ? formatDateTime(lead.dataCollectedAt) : '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Última verificação</dt>
                  <dd>{lead.lastVerifiedAt ? formatDateTime(lead.lastVerifiedAt) : '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Confiança</dt>
                  <dd>{lead.confidenceLevel ? CONFIDENCE_LABEL[lead.confidenceLevel] : '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Website (fonte)</dt>
                  <dd>{websitePresenceLabel(lead.websitePresence)}</dd>
                </div>
                {lead.websiteStatusReason ? (
                  <p className="text-xs text-zinc-500">{lead.websiteStatusReason}</p>
                ) : null}
              </dl>
              {lead.missingFields && lead.missingFields.length > 0 ? (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium uppercase text-zinc-400">Dados ausentes</p>
                  <div className="flex flex-wrap gap-1">
                    {lead.missingFields.map((field) => (
                      <Badge key={field} tone="amber">{MISSING_FIELD_LABEL[field] ?? field}</Badge>
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
                    setAnalysisMessage(null);
                    analyzeMutation.mutate();
                  }}
                  disabled={!lead.website}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  {lead.website ? 'Verificar / enriquecer' : 'Enriquecer (requer website)'}
                </Button>
                {!lead.website ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    Sem URL cadastrada a análise automática não roda. Confirme manualmente ou importe
                    detalhes seletivos do provedor.
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Score de oportunidade"
              action={<ScoreBadge score={lead.score} />}
            />
            <CardContent>
              {latestScore ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <DimensionStat
                      label={t('scoreExplain.fit', { defaultValue: 'Fit' })}
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
                      <p className="mb-1 text-xs font-medium uppercase text-zinc-500">
                        {t('scoreExplain.recommendedAction', { defaultValue: 'Ação recomendada' })}
                      </p>
                      <p className="text-sm text-zinc-200">
                        {t(`scoreExplain.actions.${latestScore.recommendedAction ?? 'NURTURE'}`, {
                          defaultValue: latestScore.recommendedAction ?? 'NURTURE',
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase text-zinc-500">
                        {t('scoreExplain.configVersion', { defaultValue: 'Versão da configuração' })}
                      </p>
                      <p className="text-sm text-zinc-200">v{latestScore.configVersion}</p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-zinc-500">
                      {t('scoreExplain.appliedRules', { defaultValue: 'Regras aplicadas' })}
                    </p>
                    <ul className="space-y-1 text-sm text-zinc-300">
                      {(latestScore.rulesApplied as Array<{
                        key: string;
                        points: number;
                        dimension?: string;
                      }>).map((rule) => (
                        <li key={rule.key} className="flex justify-between gap-3">
                          <span>
                            {t(`scoreRules.${rule.key}`, { defaultValue: rule.key })}
                            {rule.dimension ? (
                              <span className="ml-2 text-xs text-zinc-500">
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
                    <p className="mb-2 text-xs font-medium uppercase text-zinc-500">
                      {t('scoreExplain.missingData', { defaultValue: 'Dados ausentes' })}
                    </p>
                    {(latestScore.missingData ?? []).length === 0 ? (
                      <p className="text-sm text-zinc-500">—</p>
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
                <p className="text-sm text-zinc-500">
                  Score detalhado aparece após a primeira análise ou recálculo.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Análise do website"
              action={
                lead.website ? (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={analyzeMutation.isPending || analysisPending}
                    onClick={() => {
                      setAnalysisMessage(null);
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
              {analysisMessage ? (
                <p className="mb-3 text-sm text-zinc-300" role="status">
                  {analysisMessage}
                </p>
              ) : null}
              {latestAnalysis ? (
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Status: {latestAnalysis.status}
                  </p>
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <AnalysisItem label="Status HTTP" value={latestAnalysis.httpStatus?.toString() ?? '—'} />
                    <AnalysisItem label="HTTPS" value={boolLabel(latestAnalysis.https)} />
                    <AnalysisItem
                      label="Resposta"
                      value={latestAnalysis.responseTimeMs ? `${latestAnalysis.responseTimeMs} ms` : '—'}
                    />
                    <AnalysisItem label="Responsivo" value={boolLabel(latestAnalysis.hasViewport)} />
                    <AnalysisItem label="Formulário" value={boolLabel(latestAnalysis.hasContactForm)} />
                    <AnalysisItem label="Título" value={latestAnalysis.title ?? '—'} />
                  </dl>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  {lead.website
                    ? 'Ainda sem análise. Use Reanalisar ou aguarde o processamento automático.'
                    : 'Nenhum website cadastrado para analisar. A ausência na fonte é observação, não prova.'}
                </p>
              )}
              {latestAnalysis && latestAnalysis.issues.length > 0 ? (
                <ul className="mt-3 space-y-1">
                  {latestAnalysis.issues.map((issue) => (
                    <li key={issue.id}>
                      <Badge tone={issue.severity === 'CRITICAL' ? 'red' : 'amber'}>{issue.message}</Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
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
                <p className="text-sm text-zinc-500">Nenhuma atividade registrada.</p>
              ) : (
                <ol className="relative space-y-4 border-l border-zinc-800 pl-5">
                  {activitiesQuery.data.data.map((activity) => (
                    <li key={activity.id} className="relative">
                      <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-brand-500/150" aria-hidden />
                      <p className="text-sm font-medium text-zinc-50">{activity.type}</p>
                      {activity.description ? (
                        <p className="text-sm text-zinc-300">{activity.description}</p>
                      ) : null}
                      <p className="text-xs text-zinc-400">
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
                <p className="text-sm text-zinc-500">Nenhuma tarefa.</p>
              ) : (
                <ul className="space-y-2">
                  {tasksQuery.data.data.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-50">{task.title}</p>
                        <p className="text-xs text-zinc-500">
                          {task.assignee?.name ?? 'Sem responsável'} · {formatDateTime(task.dueAt)}
                        </p>
                      </div>
                      <Badge tone={task.status === 'DONE' ? 'green' : task.priority === 'HIGH' ? 'red' : 'slate'}>
                        {task.status}
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
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-100">{value}</p>
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
      <Icon className="mt-0.5 h-4 w-4 text-zinc-400" aria-hidden />
      <div>
        <p className="text-xs font-medium uppercase text-zinc-400">{label}</p>
        <p className="text-zinc-200">{value ?? '—'}</p>
      </div>
    </div>
  );
}

function AnalysisItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-zinc-400">{label}</dt>
      <dd className="truncate text-zinc-200" title={value}>
        {value}
      </dd>
    </div>
  );
}

function boolLabel(value?: boolean | null): string {
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  return '—';
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
  website: 'Website',
  whatsapp: 'WhatsApp',
  address: 'Endereço',
  city: 'Cidade',
  category: 'Categoria',
};

function websitePresenceLabel(presence?: string | null): string {
  switch (presence) {
    case 'NO_WEBSITE_REPORTED':
      return 'Fonte não informou site';
    case 'WEBSITE_FOUND':
      return 'Site informado pela fonte';
    case 'NEEDS_REVIEW':
      return 'Revisão de website necessária';
    default:
      return 'Website não cadastrado';
  }
}


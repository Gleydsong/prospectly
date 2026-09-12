import { ArrowLeft, Check, Copy, ExternalLink, MessageCircle, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type { WhatsappSequenceStage } from '@/features/agents/api';
import { useWhatsappFirstMessage, useWhatsappRecordOutreach, useWhatsappVariants } from '@/features/agents/hooks';
import { resolveTemplateId, resolveWhatsappCompose } from '@/features/agents/whatsapp-compose';
import { useMessageTemplates } from '@/features/campaigns/hooks';
import { formatMessageTemplateCategory } from '@/lib/presentation-labels';
import { fetchLead, fetchLeads } from '@/features/leads/api';
import { fetchPipelines } from '@/features/pipeline/api';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

const SEQUENCE_STAGES: { id: WhatsappSequenceStage; labelKey: string }[] = [
  { id: 'FIRST_MESSAGE', labelKey: 'agents.whatsapp.stages.FIRST_MESSAGE' },
  { id: 'FOLLOW_UP_1', labelKey: 'agents.whatsapp.stages.FOLLOW_UP_1' },
  { id: 'FOLLOW_UP_2', labelKey: 'agents.whatsapp.stages.FOLLOW_UP_2' },
  { id: 'BREAKUP', labelKey: 'agents.whatsapp.stages.BREAKUP' },
];

function buildWaLink(digits: string | null | undefined, body: string): string | null {
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

export function AgentsWhatsappPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const leadId = searchParams.get('leadId') ?? undefined;

  const [leadQuery, setLeadQuery] = useState('');
  const [leadSearch, setLeadSearch] = useState('');

  const leadsPicker = useQuery({
    queryKey: ['agents', 'whatsapp', 'lead-picker', leadSearch],
    queryFn: () =>
      fetchLeads({
        page: 1,
        pageSize: 10,
        q: leadSearch || undefined,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      }),
    enabled: !leadId,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setLeadSearch(leadQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [leadQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('agents.whatsapp.title')}
        description={t('agents.whatsapp.subtitle')}
        eyebrow={t('agents.title')}
        actions={
          <Link to="/agents">
            <Button size="sm" variant="ghost">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t('agents.back')}
            </Button>
          </Link>
        }
      />

      {!leadId ? (
        <Card>
          <CardHeader title={t('agents.pickLead')} />
          <CardContent className="space-y-3">
            <Input
              label={t('agents.searchLead')}
              placeholder={t('agents.searchLeadPlaceholder')}
              value={leadQuery}
              onChange={(event) => setLeadQuery(event.target.value)}
            />
            {leadsPicker.isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {(leadsPicker.data?.data ?? []).map((lead) => (
                  <li key={lead.id}>
                    <button
                      type="button"
                      className="flex w-full min-h-11 items-center justify-between gap-3 rounded-control border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-left hover:border-[color:var(--border-strong)]"
                      onClick={() => setSearchParams({ leadId: lead.id })}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[color:var(--ink)]">
                          {lead.companyName}
                        </span>
                        <span className="block truncate text-xs text-[color:var(--ink-muted)]">
                          {lead.phone ?? t('agents.whatsapp.noPhone')}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : (
        <WhatsappLeadSession key={leadId} leadId={leadId} onChangeLead={() => setSearchParams({})} />
      )}
    </div>
  );
}

function WhatsappLeadSession({
  leadId,
  onChangeLead,
}: {
  leadId: string;
  onChangeLead: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [sequenceStage, setSequenceStage] = useState<WhatsappSequenceStage>('FIRST_MESSAGE');
  const [templateId, setTemplateId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [previewDraft, setPreviewDraft] = useState<string | null>(null);
  const [showSavedTemplates, setShowSavedTemplates] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [copyOk, setCopyOk] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [recordActivity, setRecordActivity] = useState(true);
  const [advanceOverride, setAdvanceOverride] = useState<boolean | null>(null);
  const [stageIdOverride, setStageIdOverride] = useState<string | null>(null);
  const [followUpOverride, setFollowUpOverride] = useState<boolean | null>(null);
  const [recordSuccess, setRecordSuccess] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);

  const templates = useMessageTemplates({ page: 1, pageSize: 50 });
  const templateList = templates.data?.data ?? [];
  const resolvedTemplateId = resolveTemplateId(templateList, templateId);
  const variants = useWhatsappVariants(leadId, 4, generation, sequenceStage);
  const recordOutreach = useWhatsappRecordOutreach();
  const message = useWhatsappFirstMessage(
    showSavedTemplates && resolvedTemplateId ? leadId : undefined,
    resolvedTemplateId || undefined,
  );

  const preselected = useQuery({
    queryKey: ['leads', leadId],
    queryFn: () => fetchLead(leadId),
    enabled: Boolean(leadId),
  });

  const pipelines = useQuery({
    queryKey: ['pipelines'],
    queryFn: fetchPipelines,
    enabled: Boolean(leadId),
  });

  const allStages = useMemo(() => {
    const list = pipelines.data ?? [];
    return list.flatMap((pipeline) => pipeline.stages ?? []);
  }, [pipelines.data]);

  const compose = resolveWhatsappCompose({
    variants: variants.data?.variants ?? [],
    selectedVariantId,
    previewDraft,
    showSavedTemplates,
    templates: templateList,
    templateId,
    templateBody: message.data?.body,
    sequenceStage,
    followUpOverride,
    pipelineStages: allStages,
    currentStageId: preselected.data?.stage?.id,
    stageIdOverride,
    advanceOverride,
  });

  const digits = variants.data?.digits ?? message.data?.digits ?? null;
  const waLink = useMemo(
    () => buildWaLink(digits, compose.previewBody),
    [digits, compose.previewBody],
  );

  function resetGeneratedPreview() {
    setPreviewDraft(null);
    setSelectedVariantId('');
  }

  async function handleCopy() {
    if (!compose.previewBody) return;
    try {
      await navigator.clipboard.writeText(compose.previewBody);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 2000);
    } catch {
      // ignore
    }
  }

  async function handleConfirmRecord() {
    setRecordError(null);
    setRecordSuccess(null);
    try {
      await recordOutreach.mutateAsync({
        leadId,
        messageBody: compose.previewBody,
        variantId: compose.selectedVariant?.id,
        sequenceStage,
        advanceStageId: compose.advancePipeline && compose.newStageId ? compose.newStageId : undefined,
        scheduleFollowUpDays: compose.scheduleFollowUp ? 2 : undefined,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['leads'] }),
        queryClient.invalidateQueries({ queryKey: ['lead', leadId] }),
        queryClient.invalidateQueries({ queryKey: ['pipeline'] }),
        queryClient.invalidateQueries({ queryKey: ['agents', 'crm'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      ]);

      setRecordSuccess(t('agents.whatsapp.recordSuccess'));
      window.setTimeout(() => setRecordSuccess(null), 4000);
    } catch (err) {
      setRecordError(getApiErrorMessage(err) ?? t('agents.whatsapp.recordError'));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[color:var(--ink)]">
            {preselected.data?.companyName ?? variants.data?.companyName ?? '…'}
          </p>
          <p className="text-xs text-[color:var(--ink-muted)]">
            {preselected.data?.phone ??
              preselected.data?.whatsapp ??
              variants.data?.phone ??
              t('agents.whatsapp.noPhone')}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onChangeLead}>
          {t('agents.changeLead')}
        </Button>
      </div>

      <Card>
        <CardHeader
          title={t('agents.whatsapp.compose')}
          action={<MessageCircle className="h-5 w-5 text-brand-300" aria-hidden />}
        />
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[color:var(--ink-muted)]">
              {t('agents.whatsapp.stageLabel')}
            </label>
            <div className="flex flex-wrap gap-1 rounded-control bg-[color:var(--surface-subtle)] p-1">
              {SEQUENCE_STAGES.map((stg) => (
                <button
                  key={stg.id}
                  type="button"
                  data-testid={`sequence-tab-${stg.id}`}
                  className={cn(
                    'flex-1 rounded-control px-2.5 py-1.5 text-xs font-medium transition-all text-center',
                    sequenceStage === stg.id
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-card)] hover:text-[color:var(--ink)]',
                  )}
                  onClick={() => {
                    setSequenceStage(stg.id);
                    resetGeneratedPreview();
                    setGeneration(0);
                    setFollowUpOverride(null);
                  }}
                >
                  {t(stg.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {variants.data?.source ? (
              <span
                className={cn(
                  'rounded-control border px-2 py-0.5 text-[10px] uppercase tracking-wide',
                  variants.data.source === 'ollama'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-[color:var(--border)] bg-[color:var(--surface-card)] text-[color:var(--ink-muted)]',
                )}
                data-testid="whatsapp-source-badge"
              >
                {variants.data.source === 'ollama'
                  ? t('agents.whatsapp.sourceOllama')
                  : t('agents.whatsapp.sourceFallback')}
              </span>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              loading={variants.isFetching}
              onClick={() => {
                resetGeneratedPreview();
                setGeneration((current) => current + 1);
              }}
              data-testid="whatsapp-regenerate"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              {t('agents.whatsapp.generateAgain')}
            </Button>
          </div>

          {variants.isLoading ? <Skeleton className="h-40" /> : null}
          {variants.isError ? (
            <p className="text-sm text-red-300" role="alert">
              {getApiErrorMessage(variants.error) ?? t('agents.whatsapp.variantsError')}
            </p>
          ) : null}

          {!variants.isLoading && (variants.data?.variants.length ?? 0) > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2" data-testid="whatsapp-variants-list">
              {variants.data!.variants.map((item) => {
                const active = item.id === compose.selectedVariant?.id && !showSavedTemplates;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-testid={`whatsapp-variant-${item.angle}`}
                      className={cn(
                        'flex h-full w-full flex-col gap-1 rounded-control border px-3 py-2 text-left',
                        active
                          ? 'border-brand-500/40 bg-brand-500/10'
                          : 'border-[color:var(--border)] bg-[color:var(--surface-subtle)] hover:border-[color:var(--border-strong)]',
                      )}
                      onClick={() => {
                        setShowSavedTemplates(false);
                        setSelectedVariantId(item.id);
                        setPreviewDraft(null);
                        setCopyOk(false);
                      }}
                    >
                      <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--ink-muted)]">
                        {t(`agents.whatsapp.angles.${item.angle}`, {
                          defaultValue: item.label,
                        })}
                      </span>
                      <span className="line-clamp-3 text-sm text-[color:var(--ink)]">{item.body}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {(templates.data?.data?.length ?? 0) > 0 ? (
            <div className="space-y-2 border-t border-[color:var(--border)] pt-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowSavedTemplates((value) => !value);
                  setPreviewDraft(null);
                }}
              >
                {showSavedTemplates
                  ? t('agents.whatsapp.hideSavedTemplates')
                  : t('agents.whatsapp.useSavedTemplate')}
              </Button>
              {showSavedTemplates ? (
                <Select
                  label={t('agents.whatsapp.template')}
                  value={compose.templateId}
                  onChange={(event) => {
                    setTemplateId(event.target.value);
                    setPreviewDraft(null);
                  }}
                  disabled={templates.isLoading}
                >
                  {(templates.data?.data ?? []).map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({formatMessageTemplateCategory(template.category)})
                    </option>
                  ))}
                </Select>
              ) : null}
            </div>
          ) : null}

          <Textarea
            label={t('agents.whatsapp.preview')}
            value={compose.previewBody}
            onChange={(event) => {
              setPreviewDraft(event.target.value);
            }}
            rows={8}
            data-testid="whatsapp-preview"
          />

          <p className="text-xs text-[color:var(--ink-muted)]">{t('agents.whatsapp.assistedNote')}</p>

          {message.isError && showSavedTemplates ? (
            <p className="text-sm text-red-300" role="alert">
              {getApiErrorMessage(message.error) ?? t('agents.whatsapp.buildError')}
            </p>
          ) : null}
          {copyOk ? (
            <p className="text-sm text-emerald-300" role="status">
              {t('agents.whatsapp.copied')}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!compose.previewBody}
              onClick={() => void handleCopy()}
              data-testid="whatsapp-copy"
            >
              <Copy className="h-4 w-4" aria-hidden />
              {t('agents.whatsapp.copy')}
            </Button>
            {waLink ? (
              <a href={waLink} target="_blank" rel="noreferrer noopener" onClick={() => setShowConfirmation(true)}>
                <Button size="sm" data-testid="whatsapp-open">
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  {t('agents.whatsapp.open')}
                </Button>
              </a>
            ) : (
              <Button size="sm" disabled>
                {t('agents.whatsapp.open')}
              </Button>
            )}
            {!showConfirmation ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowConfirmation(true)}
                className="text-xs text-[color:var(--ink-muted)]"
              >
                {t('agents.whatsapp.confirmRecordTitle')}
              </Button>
            ) : null}
            <Link to={`/leads/${leadId}`}>
              <Button size="sm" variant="ghost">
                {t('agents.crm.openLead')}
              </Button>
            </Link>
          </div>

          {showConfirmation ? (
            <div className="mt-4 rounded-panel border border-brand-500/30 bg-brand-500/5 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                  {t('agents.whatsapp.confirmRecordTitle')}
                </h4>
                <span className="text-[11px] text-[color:var(--ink-muted)]">
                  {t('agents.whatsapp.openedExternal')}
                </span>
              </div>

              <div className="space-y-2 text-xs text-[color:var(--ink)]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recordActivity}
                    onChange={(e) => setRecordActivity(e.target.checked)}
                    className="rounded border-[color:var(--border)] text-brand-600 focus:ring-brand-500"
                  />
                  <span>{t('agents.whatsapp.recordActivity')}</span>
                </label>

                {allStages.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 pl-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={compose.advancePipeline}
                        onChange={(e) => setAdvanceOverride(e.target.checked)}
                        className="rounded border-[color:var(--border)] text-brand-600 focus:ring-brand-500"
                      />
                      <span>{t('agents.whatsapp.advanceStage')}</span>
                    </label>
                    {compose.advancePipeline ? (
                      <select
                        value={compose.newStageId}
                        onChange={(e) => setStageIdOverride(e.target.value)}
                        className="h-7 rounded border border-[color:var(--border)] bg-[color:var(--surface-card)] px-2 text-xs text-[color:var(--ink)]"
                      >
                        {allStages.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                ) : null}

                <div className="pl-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compose.scheduleFollowUp}
                      onChange={(e) => setFollowUpOverride(e.target.checked)}
                      className="rounded border-[color:var(--border)] text-brand-600 focus:ring-brand-500"
                    />
                    <span>{t('agents.whatsapp.scheduleFollowUp')}</span>
                  </label>
                </div>
              </div>

              {recordError ? (
                <p className="text-xs text-red-300" role="alert">
                  {recordError}
                </p>
              ) : null}

              {recordSuccess ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-300" role="status">
                  <Check className="h-4 w-4" aria-hidden />
                  <span>{recordSuccess}</span>
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => setShowConfirmation(false)}>
                  {t('common.cancel', { defaultValue: 'Cancelar' })}
                </Button>
                <Button
                  size="sm"
                  loading={recordOutreach.isPending}
                  disabled={!recordActivity}
                  onClick={() => void handleConfirmRecord()}
                  data-testid="confirm-outreach-crm-button"
                >
                  {t('agents.whatsapp.confirmAndSave')}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

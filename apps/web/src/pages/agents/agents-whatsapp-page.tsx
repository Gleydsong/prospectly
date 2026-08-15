import { ArrowLeft, Copy, ExternalLink, MessageCircle, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useWhatsappFirstMessage, useWhatsappVariants } from '@/features/agents/hooks';
import { useMessageTemplates } from '@/features/campaigns/hooks';
import { formatMessageTemplateCategory } from '@/lib/presentation-labels';
import { fetchLead, fetchLeads } from '@/features/leads/api';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

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
  const [templateId, setTemplateId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [previewBody, setPreviewBody] = useState('');
  const [previewTouched, setPreviewTouched] = useState(false);
  const [copyOk, setCopyOk] = useState(false);
  const [showSavedTemplates, setShowSavedTemplates] = useState(false);
  const [generation, setGeneration] = useState(0);

  const templates = useMessageTemplates({ page: 1, pageSize: 50 });
  const variants = useWhatsappVariants(leadId, 4, generation);
  const message = useWhatsappFirstMessage(
    leadId && showSavedTemplates && templateId ? leadId : undefined,
    templateId || undefined,
  );

  const preselected = useQuery({
    queryKey: ['leads', leadId],
    queryFn: () => fetchLead(leadId!),
    enabled: Boolean(leadId),
  });

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

  useEffect(() => {
    const list = templates.data?.data ?? [];
    if (!list.length || templateId) return;
    const whatsapp = list.find((item) => item.category.toUpperCase() === 'WHATSAPP');
    const initialTemplate = whatsapp ?? list[0];
    if (initialTemplate) setTemplateId(initialTemplate.id);
  }, [templates.data, templateId]);

  useEffect(() => {
    const items = variants.data?.variants ?? [];
    if (!items.length) return;
    const current = items.find((item) => item.id === selectedVariantId) ?? items[0];
    if (!current) return;
    if (selectedVariantId !== current.id) {
      setSelectedVariantId(current.id);
      setPreviewTouched(false);
      if (!showSavedTemplates) setPreviewBody(current.body);
      return;
    }
    if (!showSavedTemplates && !previewTouched) {
      setPreviewBody(current.body);
    }
  }, [variants.data?.variants, selectedVariantId, showSavedTemplates, previewTouched]);

  useEffect(() => {
    if (showSavedTemplates && message.data?.body != null) {
      setPreviewBody(message.data.body);
    }
  }, [message.data?.body, message.data?.templateId, showSavedTemplates]);

  const digits = variants.data?.digits ?? message.data?.digits ?? null;
  const waLink = useMemo(() => buildWaLink(digits, previewBody), [digits, previewBody]);

  function selectLead(id: string) {
    setCopyOk(false);
    setPreviewBody('');
    setPreviewTouched(false);
    setSelectedVariantId('');
    setShowSavedTemplates(false);
    setGeneration(0);
    setSearchParams({ leadId: id });
  }

  async function handleCopy() {
    if (!previewBody) return;
    try {
      await navigator.clipboard.writeText(previewBody);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 2000);
    } catch {
      // ignore
    }
  }

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
                      className="flex w-full min-h-11 items-center justify-between gap-3 rounded-control border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-left hover:border-zinc-700"
                      onClick={() => selectLead(lead.id)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-zinc-100">
                          {lead.companyName}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
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
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-zinc-100">
                {preselected.data?.companyName ?? variants.data?.companyName ?? '…'}
              </p>
              <p className="text-xs text-zinc-500">
                {preselected.data?.phone ??
                  preselected.data?.whatsapp ??
                  variants.data?.phone ??
                  t('agents.whatsapp.noPhone')}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSearchParams({})}>
              {t('agents.changeLead')}
            </Button>
          </div>

          <Card>
            <CardHeader
              title={t('agents.whatsapp.compose')}
              action={<MessageCircle className="h-5 w-5 text-brand-300" aria-hidden />}
            />
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {variants.data?.source ? (
                  <span
                    className={cn(
                      'rounded-control border px-2 py-0.5 text-[10px] uppercase tracking-wide',
                      variants.data.source === 'ollama'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-400',
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
                    setPreviewTouched(false);
                    setSelectedVariantId('');
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
                    const active = item.id === selectedVariantId && !showSavedTemplates;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          data-testid={`whatsapp-variant-${item.angle}`}
                          className={cn(
                            'flex h-full w-full flex-col gap-1 rounded-control border px-3 py-2 text-left',
                            active
                              ? 'border-brand-500/40 bg-brand-500/10'
                              : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700',
                          )}
                          onClick={() => {
                            setShowSavedTemplates(false);
                            setSelectedVariantId(item.id);
                            setPreviewBody(item.body);
                            setPreviewTouched(false);
                            setCopyOk(false);
                          }}
                        >
                          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                            {t(`agents.whatsapp.angles.${item.angle}`, {
                              defaultValue: item.label,
                            })}
                          </span>
                          <span className="line-clamp-3 text-sm text-zinc-200">{item.body}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {(templates.data?.data?.length ?? 0) > 0 ? (
                <div className="space-y-2 border-t border-zinc-800 pt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowSavedTemplates((value) => !value)}
                  >
                    {showSavedTemplates
                      ? t('agents.whatsapp.hideSavedTemplates')
                      : t('agents.whatsapp.useSavedTemplate')}
                  </Button>
                  {showSavedTemplates ? (
                    <Select
                      label={t('agents.whatsapp.template')}
                      value={templateId}
                      onChange={(event) => setTemplateId(event.target.value)}
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
                value={previewBody}
                onChange={(event) => {
                  setPreviewTouched(true);
                  setPreviewBody(event.target.value);
                }}
                rows={8}
                data-testid="whatsapp-preview"
              />

              <p className="text-xs text-zinc-500">{t('agents.whatsapp.assistedNote')}</p>

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
                  disabled={!previewBody}
                  onClick={() => void handleCopy()}
                  data-testid="whatsapp-copy"
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  {t('agents.whatsapp.copy')}
                </Button>
                {waLink ? (
                  <a href={waLink} target="_blank" rel="noreferrer noopener">
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
                <Link to={`/leads/${leadId}`}>
                  <Button size="sm" variant="ghost">
                    {t('agents.crm.openLead')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

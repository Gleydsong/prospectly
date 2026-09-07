import { ArrowLeft, MessageCircle, Workflow } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CrmDailyFocus,
  WhatsAppOutreachModal,
  type WhatsAppOutreachModalLead,
} from '@/features/agents/components';
import { useCrmApply, useCrmSuggest } from '@/features/agents/hooks';
import type { CrmActionCode } from '@/features/agents/api';
import { fetchLead, fetchLeads } from '@/features/leads/api';
import { getApiErrorMessage } from '@/lib/api';

export function AgentsCrmPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const leadId = searchParams.get('leadId') ?? undefined;

  const [leadQuery, setLeadQuery] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);
  const [whatsAppModalLead, setWhatsAppModalLead] = useState<WhatsAppOutreachModalLead | null>(null);

  const suggest = useCrmSuggest(leadId);
  const apply = useCrmApply();

  const preselected = useQuery({
    queryKey: ['leads', leadId],
    queryFn: () => fetchLead(leadId!),
    enabled: Boolean(leadId),
  });

  const leadsPicker = useQuery({
    queryKey: ['agents', 'crm', 'lead-picker', leadSearch],
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

  function selectLead(id: string) {
    setActionError(null);
    setActionOk(null);
    setSearchParams({ leadId: id });
  }

  async function handleApply() {
    if (!leadId || !suggest.data?.suggestedStage) return;
    setActionError(null);
    setActionOk(null);
    try {
      await apply.mutateAsync({
        leadId,
        stageId: suggest.data.suggestedStage.id,
      });
      setActionOk(t('agents.crm.applySuccess'));
      await suggest.refetch();
    } catch (err) {
      setActionError(getApiErrorMessage(err) ?? t('agents.crm.applyError'));
    }
  }

  const actionLabel = suggest.data
    ? t(`agents.crm.actions.${suggest.data.actionCode as CrmActionCode}`, {
        defaultValue: suggest.data.actionCode,
      })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('agents.crm.title')}
        description={t('agents.crm.subtitle')}
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
        <div className="space-y-6">
          <CrmDailyFocus
            onSelectLeadForWhatsApp={(lead) => setWhatsAppModalLead(lead)}
          />

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
                        onClick={() => selectLead(lead.id)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-[color:var(--ink)]">
                            {lead.companyName}
                          </span>
                          <span className="block truncate text-xs text-[color:var(--ink-muted)]">
                            {[lead.city, lead.segment].filter(Boolean).join(' · ') || '—'}
                          </span>
                        </span>
                        <span className="text-xs text-[color:var(--ink-muted)]">score {lead.score}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-[color:var(--ink)]">
                {preselected.data?.companyName ?? suggest.data?.companyName ?? '…'}
              </p>
              <p className="text-xs text-[color:var(--ink-muted)]">{t('agents.crm.selectedLead')}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSearchParams({})}>
              {t('agents.changeLead')}
            </Button>
          </div>

          {suggest.isLoading ? (
            <Skeleton className="h-48" />
          ) : suggest.isError ? (
            <p className="rounded-control bg-red-500/10 p-3 text-sm text-red-300" role="alert">
              {getApiErrorMessage(suggest.error) ?? t('agents.crm.suggestError')}
            </p>
          ) : suggest.data ? (
            <Card>
              <CardHeader
                title={t('agents.crm.nextAction')}
                action={<Workflow className="h-5 w-5 text-brand-300" aria-hidden />}
              />
              <CardContent className="space-y-4">
                <div
                  className={
                    suggest.data.severity === 'critical'
                      ? 'rounded-control border border-red-500/30 bg-red-500/10 px-3 py-2'
                      : suggest.data.severity === 'warn'
                        ? 'rounded-control border border-amber-500/30 bg-amber-500/10 px-3 py-2'
                        : 'rounded-control border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2'
                  }
                >
                  <p className="text-sm font-medium text-[color:var(--ink)]">{actionLabel}</p>
                  <p className="mt-1 text-sm text-[color:var(--ink-muted)]">{suggest.data.rationale}</p>
                </div>

                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase text-[color:var(--ink-muted)]">{t('agents.crm.currentStage')}</dt>
                    <dd className="text-[color:var(--ink)]">
                      {suggest.data.currentStage?.name ?? t('agents.crm.noStage')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-[color:var(--ink-muted)]">
                      {t('agents.crm.suggestedStage')}
                    </dt>
                    <dd className="text-[color:var(--ink)]">
                      {suggest.data.suggestedStage?.name ?? t('agents.crm.noSuggestedStage')}
                    </dd>
                  </div>
                </dl>

                {actionError ? (
                  <p className="text-sm text-red-300" role="alert">
                    {actionError}
                  </p>
                ) : null}
                {actionOk ? (
                  <p className="text-sm text-emerald-300" role="status">
                    {actionOk}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => navigate(suggest.data.href)}>
                    {t('agents.crm.openHref')}
                  </Button>
                  <Link to={`/leads/${suggest.data.leadId}`}>
                    <Button size="sm" variant="secondary">
                      {t('agents.crm.openLead')}
                    </Button>
                  </Link>
                  {preselected.data?.phone || preselected.data?.whatsapp ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setWhatsAppModalLead({
                          id: suggest.data.leadId,
                          companyName: suggest.data.companyName,
                          phone: preselected.data?.phone,
                          whatsapp: preselected.data?.whatsapp,
                          stageId: suggest.data.currentStage?.id,
                          doNotContact: preselected.data?.doNotContact,
                        })
                      }
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden />
                      {t('agents.whatsapp.open')}
                    </Button>
                  ) : null}
                  {suggest.data.canApplyStage ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={apply.isPending}
                      onClick={() => void handleApply()}
                    >
                      {t('agents.crm.moveStage')}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      <WhatsAppOutreachModal
        lead={whatsAppModalLead}
        isOpen={Boolean(whatsAppModalLead)}
        onClose={() => setWhatsAppModalLead(null)}
      />
    </div>
  );
}

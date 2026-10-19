import { CheckCircle2, Globe2, Loader2, ShieldAlert, Sparkles } from 'lucide-react';

import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { SeoAudit, SeoOpportunityLevel } from '@/types';

import { SeoAuditSection } from './seo-audit-section';

type AnalysisIssue = {
  id: string;
  code: string;
  severity: string;
  message: string;
};

export type LeadWebsiteAnalysis = {
  id: string;
  status: string;
  httpStatus?: number | null;
  https?: boolean | null;
  responseTimeMs?: number | null;
  title?: string | null;
  hasViewport?: boolean | null;
  hasContactForm?: boolean | null;
  seoHealthScore?: number | null;
  seoOpportunity?: SeoOpportunityLevel | null;
  architecture?: string | null;
  seoAudit?: SeoAudit | null;
  completedAt?: string | null;
  issues: AnalysisIssue[];
};

type Tone = 'idle' | 'pending' | 'ok' | 'warn' | 'fail';

function speedLabel(ms?: number | null): string {
  if (ms == null) return '—';
  if (ms < 400) return 'clientFile.speedFast';
  if (ms < 1200) return 'clientFile.speedGood';
  if (ms < 3000) return 'clientFile.speedSlow';
  return 'clientFile.speedVerySlow';
}

function resolveTone(analysis: LeadWebsiteAnalysis | null | undefined, hasWebsite: boolean): Tone {
  if (!hasWebsite) return 'idle';
  if (!analysis) return 'idle';
  if (analysis.status === 'PENDING' || analysis.status === 'RUNNING') return 'pending';
  if (analysis.status === 'FAILED') return 'fail';
  if (analysis.status === 'COMPLETED') {
    const critical = analysis.issues.some((i) => i.severity === 'CRITICAL');
    if (critical || analysis.https === false) return 'warn';
    return 'ok';
  }
  return 'idle';
}

const BANNER: Record<
  Tone,
  { title: string; body: string; icon: typeof Sparkles; shell: string; iconClass: string }
> = {
  idle: {
    title: 'clientFile.bannerIdleTitle',
    body: 'clientFile.bannerIdleBody',
    icon: Globe2,
    shell: 'border-[color:var(--border)] bg-[color:var(--surface-subtle)]',
    iconClass: 'text-[color:var(--ink-muted)]',
  },
  pending: {
    title: 'clientFile.bannerPendingTitle',
    body: 'clientFile.bannerPendingBody',
    icon: Loader2,
    shell: 'border-brand-400/25 bg-brand-500/[0.08]',
    iconClass: 'text-[color:var(--status-info-ink)] animate-spin',
  },
  ok: {
    title: 'clientFile.bannerOkTitle',
    body: 'clientFile.bannerOkBody',
    icon: CheckCircle2,
    shell: 'border-emerald-400/25 bg-emerald-500/[0.08]',
    iconClass: 'text-[color:var(--status-success-ink)]',
  },
  warn: {
    title: 'clientFile.bannerWarnTitle',
    body: 'clientFile.bannerWarnBody',
    icon: Sparkles,
    shell: 'border-amber-400/25 bg-amber-500/[0.08]',
    iconClass: 'text-[color:var(--status-warning-ink)]',
  },
  fail: {
    title: 'clientFile.bannerFailTitle',
    body: 'clientFile.bannerFailBody',
    icon: ShieldAlert,
    shell: 'border-red-400/25 bg-red-500/[0.08]',
    iconClass: 'text-[color:var(--status-danger-ink)]',
  },
};

function Signal({
  label,
  value,
  hint,
  positive,
}: {
  label: string;
  value: string;
  hint?: string;
  positive?: boolean | null;
}) {
  return (
    <div className="rounded-control border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-sm font-medium',
          positive === true && 'text-[color:var(--status-success-ink)]',
          positive === false && 'text-[color:var(--status-warning-ink)]',
          positive == null && 'text-[color:var(--ink)]',
        )}
        title={hint}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-[color:var(--ink-muted)]">{hint}</p> : null}
    </div>
  );
}

interface WebsiteAnalysisPanelProps {
  hasWebsite: boolean;
  analysis?: LeadWebsiteAnalysis | null;
  errorMessage?: string | null;
}

/**
 * Painel amigável da análise de site — sem jargão de fila/API.
 */
export function WebsiteAnalysisPanel({
  hasWebsite,
  analysis,
  errorMessage,
}: WebsiteAnalysisPanelProps) {
  const { t } = useTranslation();
  const health =
    analysis?.status === 'COMPLETED' && Number.isFinite(analysis.seoHealthScore)
      ? Math.max(0, Math.min(100, analysis.seoHealthScore!))
      : null;
  const groups = [
    { key: 'security', codes: ['NO_HTTPS', 'SSRF_BLOCKED', 'FETCH_FAILED'] },
    { key: 'seo', codes: ['NO_META_DESCRIPTION'] },
    { key: 'experience', codes: ['NOT_RESPONSIVE', 'NO_CONTACT_FORM', 'SLOW'] },
    { key: 'other', codes: [] },
  ];
  const knownCodes = groups.flatMap((group) => group.codes);
  const tone = errorMessage ? 'fail' : resolveTone(analysis, hasWebsite);
  const banner = errorMessage
    ? {
        ...BANNER.fail,
        title: 'clientFile.bannerErrorTitle',
        body: 'clientFile.bannerErrorBody',
      }
    : !hasWebsite
      ? {
          ...BANNER.idle,
          title: 'clientFile.bannerNoSiteTitle',
          body: 'clientFile.bannerNoSiteBody',
        }
      : BANNER[tone];

  const Icon = banner.icon;
  const showSignals = analysis && (analysis.status === 'COMPLETED' || analysis.status === 'FAILED');

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-[color:var(--ink-muted)]">{t('clientFile.siteHealth')}</p>
        <p className="my-3 font-mono text-3xl text-[color:var(--ink)]">
          {health === null ? '—' : `${health} / 100`}
        </p>
        {health !== null ? (
          <div
            role="meter"
            aria-label={t('clientFile.siteHealth')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={health}
            className="h-2.5 overflow-hidden rounded-full bg-[color:var(--surface-subtle)]"
          >
            <div
              className="h-full rounded-full bg-[color:var(--status-warning-ink)]"
              style={{ width: `${health}%` }}
            />
          </div>
        ) : (
          <p className="text-sm text-[color:var(--ink-muted)]">
            {t('clientFile.healthUnavailable')}
          </p>
        )}
        {analysis?.completedAt ? (
          <p className="mt-3 text-xs text-[color:var(--ink-muted)]">
            {t('clientFile.analysisCompleted', {
              date: new Date(analysis.completedAt).toLocaleString(t('clientFile.dateLocale')),
            })}
          </p>
        ) : null}
      </div>
      {analysis?.status === 'COMPLETED' ? (
        <div className="space-y-2">
          {groups.map((group) => {
            const issues = analysis.issues.filter((issue) =>
              group.key === 'other'
                ? !knownCodes.includes(issue.code)
                : group.codes.includes(issue.code),
            );
            if (!issues.length) return null;
            return (
              <section
                key={group.key}
                className="rounded-control bg-[color:var(--surface-subtle)] p-3"
              >
                <h4 className="text-sm font-semibold text-[color:var(--ink)]">
                  {t(`clientFile.issueGroups.${group.key}`)}
                </h4>
                <ul className="mt-1 space-y-1 text-sm text-[color:var(--ink-muted)]">
                  {issues.map((issue) => (
                    <li key={issue.id}>
                      {t(`clientFile.issueCodes.${issue.code}`, { defaultValue: issue.message })}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {analysis.issues.length === 0 ? (
            <p className="text-sm text-[color:var(--ink-muted)]">{t('clientFile.noIssues')}</p>
          ) : null}
        </div>
      ) : null}
      <details>
        <summary className="cursor-pointer text-sm text-[color:var(--ink)]">
          {t('clientFile.fullAnalysis')}
        </summary>
        <div className="mt-3 space-y-4">
          <div
            className={cn('flex gap-3 rounded-panel border px-4 py-3.5', banner.shell)}
            role="status"
            aria-live="polite"
          >
            <div
              className={cn(
                'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-hover)]',
                banner.iconClass,
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[color:var(--ink)]">{t(banner.title)}</p>
              <p className="mt-1 text-sm leading-relaxed text-[color:var(--ink-muted)]">
                {t(banner.body)}
              </p>
            </div>
          </div>

          {showSignals ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Signal
                label={t('clientFile.opensInBrowser')}
                value={
                  analysis.httpStatus && analysis.httpStatus < 400
                    ? t('clientFile.yes')
                    : t('clientFile.unclear')
                }
                positive={Boolean(analysis.httpStatus && analysis.httpStatus < 400)}
              />
              <Signal
                label={t('clientFile.secureConnection')}
                value={
                  analysis.https === true
                    ? t('clientFile.yesHttps')
                    : analysis.https === false
                      ? t('clientFile.no')
                      : '—'
                }
                positive={analysis.https}
                hint={analysis.https === false ? t('clientFile.migrateHttps') : undefined}
              />
              <Signal
                label={t('clientFile.speed')}
                value={t(speedLabel(analysis.responseTimeMs))}
                hint={analysis.responseTimeMs != null ? `${analysis.responseTimeMs} ms` : undefined}
                positive={
                  analysis.responseTimeMs == null
                    ? null
                    : analysis.responseTimeMs < 1200
                      ? true
                      : false
                }
              />
              <Signal
                label={t('clientFile.mobile')}
                value={
                  analysis.hasViewport === true
                    ? t('clientFile.yes')
                    : analysis.hasViewport === false
                      ? t('clientFile.uncertain')
                      : '—'
                }
                positive={analysis.hasViewport}
              />
              <Signal
                label={t('clientFile.form')}
                value={
                  analysis.hasContactForm === true
                    ? t('clientFile.found')
                    : analysis.hasContactForm === false
                      ? t('clientFile.notFoundSignal')
                      : '—'
                }
                positive={analysis.hasContactForm}
              />
              <Signal
                label={t('clientFile.pageTitle')}
                value={analysis.title?.trim() || t('clientFile.notProvided')}
                positive={analysis.title ? true : null}
              />
            </div>
          ) : null}

          {showSignals && analysis.seoAudit ? <SeoAuditSection audit={analysis.seoAudit} /> : null}
        </div>
      </details>
    </div>
  );
}

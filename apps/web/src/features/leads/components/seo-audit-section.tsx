import { ChevronDown, Zap } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SeoAudit, SeoFinding, SeoOpportunityLevel } from '@/types';

type BadgeTone = 'green' | 'blue' | 'amber' | 'red';

const SEO_OPPORTUNITY_LABEL: Record<SeoOpportunityLevel, { label: string; tone: BadgeTone }> = {
  LOW: { label: 'Oportunidade baixa', tone: 'green' },
  MEDIUM: { label: 'Oportunidade média', tone: 'blue' },
  HIGH: { label: 'Oportunidade alta', tone: 'amber' },
  CRITICAL: { label: 'Oportunidade crítica', tone: 'red' },
};

const VECTOR_LABEL: Record<keyof SeoAudit['vectors'], string> = {
  INDEXABILITY: 'Renderização & indexação',
  ON_PAGE: 'On-page & semântica',
  PERFORMANCE: 'Performance',
  LOCAL_INFRA: 'SEO local & infra',
};

const SEVERITY_LABEL: Record<SeoFinding['severity'], { label: string; tone: BadgeTone }> = {
  HIGH: { label: 'Alta', tone: 'red' },
  MEDIUM: { label: 'Média', tone: 'amber' },
  LOW: { label: 'Baixa', tone: 'blue' },
};

function healthTone(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-sky-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-600';
}

function ScoreRing({ score }: { score: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  return (
    <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`SEO Health Score ${score} de 100`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-[color:var(--border)]" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('stroke-current', healthTone(score))}
        />
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums',
          healthTone(score),
        )}
      >
        {score}
      </span>
    </div>
  );
}

function FindingItem({ finding }: { finding: SeoFinding }) {
  const [open, setOpen] = useState(false);
  const severity = SEVERITY_LABEL[finding.severity];
  return (
    <li className="rounded-control border border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <Badge tone={severity.tone}>{severity.label}</Badge>
        <span className="min-w-0 flex-1 text-sm font-medium text-[color:var(--ink)]">{finding.title}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-[color:var(--ink-muted)] transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <dl className="space-y-2 border-t border-[color:var(--border)] px-3 py-3 text-sm">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
              Diagnóstico técnico
            </dt>
            <dd className="mt-0.5 text-[color:var(--ink)]">{finding.diagnosis}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
              Impacto no Google
            </dt>
            <dd className="mt-0.5 text-[color:var(--ink)]">{finding.impact}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
              Correção recomendada
            </dt>
            <dd className="mt-0.5 text-[color:var(--ink)]">{finding.fix}</dd>
          </div>
        </dl>
      ) : null}
    </li>
  );
}

interface SeoAuditSectionProps {
  audit: SeoAudit;
}

/**
 * Scorecard Prospectly: SEO Health, Opportunity, arquitetura, top-3 falhas e quick wins.
 */
export function SeoAuditSection({ audit }: SeoAuditSectionProps) {
  const opportunity = SEO_OPPORTUNITY_LABEL[audit.opportunity];
  const vectors = Object.entries(audit.vectors) as Array<
    [keyof SeoAudit['vectors'], SeoAudit['vectors'][keyof SeoAudit['vectors']]]
  >;

  return (
    <section className="space-y-4" aria-label="SEO e oportunidade">
      <div className="flex flex-wrap items-center gap-4 rounded-panel border border-[color:var(--border)] px-4 py-3.5">
        <ScoreRing score={audit.healthScore} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
            SEO Health Score
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={opportunity.tone}>{opportunity.label}</Badge>
            <span className="text-xs text-[color:var(--ink-muted)]">Arquitetura: {audit.architecture}</span>
          </div>
        </div>
        <ul className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[260px]">
          {vectors.map(([key, value]) => (
            <li key={key} className="space-y-1">
              <div className="flex justify-between text-[11px] text-[color:var(--ink-muted)]">
                <span>{VECTOR_LABEL[key]}</span>
                <span className="tabular-nums">
                  {value.score}/{value.max}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-hover)]">
                <div
                  className="h-full rounded-full bg-brand-400"
                  style={{ width: `${Math.round((value.score / value.max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {audit.topIssues.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[color:var(--ink)]">Sinais de oportunidade</p>
          <ul className="space-y-2">
            {audit.topIssues.map((finding) => (
              <FindingItem key={finding.code} finding={finding} />
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-[color:var(--ink-muted)]">Nenhuma falha relevante de SEO encontrada.</p>
      )}

      {audit.quickWins.length > 0 ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ink)]">
            <Zap className="h-4 w-4 text-amber-500" aria-hidden />
            Quick wins (menos de 1h)
          </p>
          <ul className="space-y-1.5">
            {audit.quickWins.map((finding) => (
              <li key={finding.code} className="text-sm text-[color:var(--ink)]">
                <span className="font-medium">{finding.title}:</span>{' '}
                <span className="text-[color:var(--ink-muted)]">{finding.fix}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

import { Building2, ExternalLink, MapPin, Phone, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { OpportunityCandidateView } from '@/types';

const categoryPresentation = {
  EXCELLENT: { label: 'Excelente', tone: 'green' },
  HIGH: { label: 'Alta', tone: 'blue' },
  MEDIUM: { label: 'Média', tone: 'amber' },
  LOW: { label: 'Baixa', tone: 'slate' },
} as const;

export function OpportunityCandidateCard({
  candidate,
  onOpen,
}: {
  candidate: OpportunityCandidateView;
  onOpen: (candidate: OpportunityCandidateView) => void;
}) {
  const category = categoryPresentation[candidate.rankingCategory];
  const safeWebsite = (() => {
    if (!candidate.company.website) return null;
    try {
      const parsed = new URL(candidate.company.website);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
    } catch { return null; }
  })();
  return (
    <Card interactive className="h-full">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={category.tone}>{category.label}</Badge>
              {candidate.explanation?.source === 'AI' ? (
                <Badge tone="purple"><Sparkles className="h-3 w-3" /> IA</Badge>
              ) : null}
            </div>
            <h3 className="truncate text-base font-bold text-[color:var(--ink)]">
              {candidate.company.companyName}
            </h3>
            <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
              {candidate.company.category ?? 'Categoria não informada'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <strong className="text-2xl text-[color:var(--ink)]">{candidate.overallScore}</strong>
            <span className="block text-xs text-[color:var(--ink-muted)]">de 100</span>
          </div>
        </div>

        <div className="space-y-2 text-sm text-[color:var(--ink-muted)]">
          <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{candidate.company.city}, {candidate.company.state}</p>
          {candidate.company.phone ? <p className="flex items-center gap-2"><Phone className="h-4 w-4" />{candidate.company.phone}</p> : null}
          {safeWebsite ? (
            <a className="flex items-center gap-2 text-[color:var(--accent)] hover:underline" href={safeWebsite} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> Abrir website
            </a>
          ) : <p className="flex items-center gap-2"><Building2 className="h-4 w-4" />Website não reportado pela fonte</p>}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 rounded-control bg-[color:var(--surface-hover)] p-3 text-xs">
          <span>Confiança <strong className="block text-sm text-[color:var(--ink)]">{candidate.confidenceScore}%</strong></span>
          <span>Dados completos <strong className="block text-sm text-[color:var(--ink)]">{candidate.dataCompleteness}%</strong></span>
        </div>
        <Button variant="secondary" className="w-full" onClick={() => onOpen(candidate)}>
          Ver evidências
        </Button>
      </CardContent>
    </Card>
  );
}

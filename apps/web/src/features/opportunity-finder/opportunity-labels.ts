import type { OpportunityCandidateView } from '@/types';

type OpportunitySignal = OpportunityCandidateView['signals'][number];
type OpportunityDimension = keyof OpportunityCandidateView['scoreBreakdown']['dna'];

const EVIDENCE_KIND_LABELS: Record<OpportunitySignal['kind'], string> = {
  FACT: 'Fato',
  INFERENCE: 'Inferência',
  RECOMMENDATION: 'Recomendação',
  UNKNOWN: 'Desconhecido',
};

const EVIDENCE_SOURCE_LABELS: Record<OpportunitySignal['source'], string> = {
  PROVIDER: 'Provedor de dados',
  WEBSITE_ANALYZER: 'Analisador de site',
  DETERMINISTIC_RULE: 'Regra determinística',
};

const DIMENSION_LABELS: Record<OpportunityDimension, string> = {
  need: 'Necessidade',
  quality: 'Qualidade',
  reach: 'Alcance',
  timing: 'Momento',
  fit: 'Aderência',
};

export function formatEvidenceKind(kind: OpportunitySignal['kind']): string {
  return EVIDENCE_KIND_LABELS[kind];
}

export function formatEvidenceSource(source: OpportunitySignal['source']): string {
  return EVIDENCE_SOURCE_LABELS[source];
}

export function formatOpportunityDimension(dimension: string): string {
  return DIMENSION_LABELS[dimension as OpportunityDimension] ?? 'Dimensão adicional';
}

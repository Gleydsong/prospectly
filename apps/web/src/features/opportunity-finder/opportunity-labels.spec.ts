import { describe, expect, it } from 'vitest';

import {
  formatEvidenceKind,
  formatEvidenceSource,
  formatOpportunityDimension,
} from './opportunity-labels';

describe('opportunity labels in pt-BR', () => {
  it('translates every evidence kind', () => {
    expect(formatEvidenceKind('FACT')).toBe('Fato');
    expect(formatEvidenceKind('INFERENCE')).toBe('Inferência');
    expect(formatEvidenceKind('RECOMMENDATION')).toBe('Recomendação');
    expect(formatEvidenceKind('UNKNOWN')).toBe('Desconhecido');
  });

  it('translates evidence sources and score dimensions', () => {
    expect(formatEvidenceSource('PROVIDER')).toBe('Provedor de dados');
    expect(formatEvidenceSource('WEBSITE_ANALYZER')).toBe('Analisador de site');
    expect(formatEvidenceSource('DETERMINISTIC_RULE')).toBe('Regra determinística');
    expect(formatOpportunityDimension('need')).toBe('Necessidade');
    expect(formatOpportunityDimension('quality')).toBe('Qualidade');
    expect(formatOpportunityDimension('reach')).toBe('Alcance');
    expect(formatOpportunityDimension('timing')).toBe('Momento');
    expect(formatOpportunityDimension('fit')).toBe('Aderência');
    expect(formatOpportunityDimension('unknown')).toBe('Dimensão adicional');
  });
});

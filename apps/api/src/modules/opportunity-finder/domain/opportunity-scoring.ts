import type {
  OpportunityCompany,
  OpportunityDna,
  OpportunityFinderSignal,
  OpportunityFinderSignalType,
  OpportunityProfile,
  OpportunityScoreBreakdown,
  WebsiteAnalysisResult,
} from '@prospectly/shared-types';

import { OPPORTUNITY_SCORE_VERSION } from '../opportunity-finder.constants';
import { OPPORTUNITY_SCORE_CONFIG as config } from './opportunity-score.config';

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
const checkedAt = () => new Date().toISOString();

function signal(
  type: OpportunityFinderSignalType,
  value: OpportunityFinderSignal['value'],
  source: OpportunityFinderSignal['source'],
  confidence: number,
  evidence: string,
  kind: OpportunityFinderSignal['kind'] = 'FACT',
): OpportunityFinderSignal {
  return { type, value, source, confidence: clamp(confidence * 100) / 100, evidence, kind, checkedAt: checkedAt() };
}

export function buildOpportunitySignals(
  company: OpportunityCompany,
  analysis?: WebsiteAnalysisResult | null,
): OpportunityFinderSignal[] {
  const hasContact = Boolean(company.phone?.trim() || company.email?.trim());
  const websiteMissing = company.websitePresence === 'NO_WEBSITE_REPORTED';
  const websiteKnown = company.websitePresence === 'WEBSITE_FOUND' && Boolean(company.website);
  const analysisKnown = Boolean(analysis && (analysis.accessible || analysis.httpStatus));

  return [
    signal(
      'MISSING_WEBSITE',
      websiteMissing ? 'TRUE' : websiteKnown ? 'FALSE' : 'UNKNOWN',
      'PROVIDER',
      websiteMissing ? 0.58 : websiteKnown ? 0.9 : 0.35,
      websiteMissing
        ? 'A fonte de descoberta não reportou website; isso não confirma ausência.'
        : websiteKnown ? 'A fonte reportou um website.' : 'Presença de website inconclusiva.',
      websiteMissing ? 'INFERENCE' : websiteKnown ? 'FACT' : 'UNKNOWN',
    ),
    signal('LOW_PERFORMANCE', analysis?.responseTimeMs == null ? 'UNKNOWN' : analysis.responseTimeMs >= 3000 ? 'TRUE' : 'FALSE', 'WEBSITE_ANALYZER', analysisKnown ? 0.9 : 0.2, analysis?.responseTimeMs == null ? 'Tempo de resposta indisponível.' : `Resposta HTTP medida em ${analysis.responseTimeMs} ms.`, analysis?.responseTimeMs == null ? 'UNKNOWN' : 'FACT'),
    signal('MISSING_HTTPS', analysis?.https == null ? 'UNKNOWN' : analysis.https ? 'FALSE' : 'TRUE', 'WEBSITE_ANALYZER', analysisKnown ? 0.95 : 0.2, analysis?.https == null ? 'HTTPS não pôde ser verificado.' : analysis.https ? 'Website acessível por HTTPS.' : 'URL final não utiliza HTTPS.', analysis?.https == null ? 'UNKNOWN' : 'FACT'),
    signal('MISSING_MOBILE_SUPPORT', analysis?.hasViewport == null ? 'UNKNOWN' : analysis.hasViewport ? 'FALSE' : 'TRUE', 'WEBSITE_ANALYZER', analysisKnown ? 0.82 : 0.2, analysis?.hasViewport == null ? 'Viewport móvel não pôde ser verificado.' : analysis.hasViewport ? 'Meta viewport detectada.' : 'Meta viewport não detectada.', analysis?.hasViewport == null ? 'UNKNOWN' : 'FACT'),
    signal('MISSING_BOOKING', analysis?.hasBooking == null ? 'UNKNOWN' : analysis.hasBooking ? 'FALSE' : 'TRUE', 'WEBSITE_ANALYZER', analysisKnown ? 0.72 : 0.2, analysis?.hasBooking == null ? 'Agendamento não pôde ser verificado.' : analysis.hasBooking ? 'Sinal de agendamento detectado.' : 'Nenhum link ou formulário de agendamento foi detectado.', analysis?.hasBooking == null ? 'UNKNOWN' : 'INFERENCE'),
    signal('MISSING_WHATSAPP', analysis?.hasWhatsapp == null ? 'UNKNOWN' : analysis.hasWhatsapp ? 'FALSE' : 'TRUE', 'WEBSITE_ANALYZER', analysisKnown ? 0.82 : 0.2, analysis?.hasWhatsapp == null ? 'WhatsApp não pôde ser verificado.' : analysis.hasWhatsapp ? 'Link ou referência ao WhatsApp detectado.' : 'WhatsApp não detectado no HTML analisado.', analysis?.hasWhatsapp == null ? 'UNKNOWN' : 'INFERENCE'),
    signal('MISSING_CONTACT_FORM', analysis?.hasContactForm == null ? 'UNKNOWN' : analysis.hasContactForm ? 'FALSE' : 'TRUE', 'WEBSITE_ANALYZER', analysisKnown ? 0.8 : 0.2, analysis?.hasContactForm == null ? 'Formulário não pôde ser verificado.' : analysis.hasContactForm ? 'Formulário de contato detectado.' : 'Formulário de contato não detectado.', analysis?.hasContactForm == null ? 'UNKNOWN' : 'INFERENCE'),
    signal('HIGH_REVIEW_COUNT', company.reviewCount == null ? 'UNKNOWN' : company.reviewCount >= 50 ? 'TRUE' : 'FALSE', 'PROVIDER', company.reviewCount == null ? 0.2 : 0.95, company.reviewCount == null ? 'Quantidade de avaliações indisponível.' : `${company.reviewCount} avaliações reportadas pela fonte.`, company.reviewCount == null ? 'UNKNOWN' : 'FACT'),
    signal('HIGH_RATING', company.rating == null ? 'UNKNOWN' : company.rating >= 4 ? 'TRUE' : 'FALSE', 'PROVIDER', company.rating == null ? 0.2 : 0.95, company.rating == null ? 'Nota indisponível.' : `Nota ${company.rating.toFixed(1)} reportada pela fonte.`, company.rating == null ? 'UNKNOWN' : 'FACT'),
    signal('CONTACT_AVAILABLE', hasContact ? 'TRUE' : 'UNKNOWN', 'PROVIDER', hasContact ? 0.9 : 0.3, hasContact ? 'Telefone ou e-mail disponível.' : 'Nenhum contato direto foi reportado.', hasContact ? 'FACT' : 'UNKNOWN'),
    signal('ACTIVE_BUSINESS', 'TRUE', 'PROVIDER', 0.65, 'Empresa retornada por uma fonte ativa de descoberta.', 'INFERENCE'),
  ];
}

const isTrue = (signals: OpportunityFinderSignal[], type: OpportunityFinderSignalType) =>
  signals.some((entry) => entry.type === type && entry.value === 'TRUE');

export function scoreOpportunity(
  company: OpportunityCompany,
  profile: OpportunityProfile,
  signals: OpportunityFinderSignal[],
): { breakdown: OpportunityScoreBreakdown; overall: number; confidence: number; completeness: number; category: 'EXCELLENT' | 'HIGH' | 'MEDIUM' | 'LOW' } {
  const need = clamp(
    Object.entries(config.need).reduce(
      (total, [type, points]) => total + (isTrue(signals, type as OpportunityFinderSignalType) ? points : 0),
      0,
    ),
  );
  const quality = clamp(
    (isTrue(signals, 'HIGH_RATING') ? config.quality.HIGH_RATING : config.qualityDefaults.ratingUnknownOrLow) +
    (isTrue(signals, 'HIGH_REVIEW_COUNT') ? config.quality.HIGH_REVIEW_COUNT : config.qualityDefaults.reviewsUnknownOrLow) +
    (isTrue(signals, 'ACTIVE_BUSINESS') ? config.quality.ACTIVE_BUSINESS : 0),
  );
  const reach = clamp(
    (isTrue(signals, 'CONTACT_AVAILABLE') ? config.reach.CONTACT_AVAILABLE : config.reachDefault) +
    (company.website ? config.reach.WEBSITE_AVAILABLE : 0) +
    (isTrue(signals, 'MISSING_WHATSAPP') ? 0 : config.reach.WHATSAPP_AVAILABLE),
  );
  const timing = clamp(config.timing.base + (need * config.timing.needFactor) + (quality * config.timing.qualityFactor));
  const fit = clamp(profile.categories.includes(company.category as never) ? config.fit.categoryMatch : company.category ? config.fit.knownCategory : config.fit.unknownCategory);
  const dna: OpportunityDna = { need, quality, reach, timing, fit };
  const overall = clamp(need * config.overall.need + quality * config.overall.quality + reach * config.overall.reach + timing * config.overall.timing + fit * config.overall.fit);
  const known = signals.filter((entry) => entry.value !== 'UNKNOWN');
  const completeness = clamp((known.length / signals.length) * 100);
  const confidence = clamp(
    completeness * config.confidence.completeness +
    (known.length ? (known.reduce((sum, entry) => sum + entry.confidence, 0) / known.length) * config.confidence.evidence : 0),
  );
  const category = overall >= config.ranking.excellent ? 'EXCELLENT' : overall >= config.ranking.high ? 'HIGH' : overall >= config.ranking.medium ? 'MEDIUM' : 'LOW';
  const reasons = signals
    .filter((entry) => entry.value === 'TRUE')
    .map((entry) => ({
      signal: entry.type,
      dimension: (['HIGH_RATING', 'HIGH_REVIEW_COUNT', 'ACTIVE_BUSINESS'].includes(entry.type) ? 'quality' : entry.type === 'CONTACT_AVAILABLE' ? 'reach' : 'need') as keyof OpportunityDna,
      points: config.need[entry.type as keyof typeof config.need] ?? config.quality[entry.type as keyof typeof config.quality] ?? (entry.type === 'CONTACT_AVAILABLE' ? config.reach.CONTACT_AVAILABLE : 10),
      label: entry.evidence,
    }));

  return { breakdown: { version: OPPORTUNITY_SCORE_VERSION, dna, reasons }, overall, confidence, completeness, category };
}

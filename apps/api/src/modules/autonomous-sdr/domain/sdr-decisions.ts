import { InvalidSdrDecisionError } from './sdr-errors';

export const OPPORTUNITY_SCORE_VERSION = 'opportunity-score-v1';

const STRATEGY_CHOICES = new Set([
  'website_problem',
  'growth_opportunity',
  'social_proof',
  'conversion_improvement',
  'local_market',
]);

const INTENT_CHOICES = new Set([
  'INTERESTED',
  'MEETING_REQUEST',
  'QUESTION',
  'NOT_NOW',
  'NOT_INTERESTED',
  'OPT_OUT',
  'UNKNOWN',
]);

export type NoulAnswer = { type: 'noul'; noul: number };

export type ChoiceAnswer = {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

export type ScoreAnswer = {
  type: 'score';
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
};

export type SdrDecisionAnswer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export type Qualification = 'QUALIFIED' | 'REJECTED' | 'REVIEW';

export type DecisionRecord = {
  organizationId: string;
  campaignId: string;
  prospectId: string;
  traceId: string;
  recordedAt: string;
  ruleVersion: typeof OPPORTUNITY_SCORE_VERSION;
  qualification: Qualification;
  opportunityScore: number | null;
  untrustedText: string;
  failure: string | null;
};

export interface SdrDecisionProvider {
  judge(request: unknown): Promise<unknown>;
}

function fail(message: string): never {
  throw new InvalidSdrDecisionError(message);
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(message);
  return value as Record<string, unknown>;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    fail(`${field} must be a finite number`);
  return value;
}

function probabilityMap(value: unknown): Record<string, number> {
  const record = asRecord(value, 'probabilities must be an object');
  const parsed: Record<string, number> = {};
  for (const [key, probability] of Object.entries(record)) {
    parsed[key] = finiteNumber(probability, `probabilities.${key}`);
  }
  return parsed;
}

export function parseLayaAnswer(payload: unknown): SdrDecisionAnswer {
  const record = asRecord(payload, 'Decision answer must be an object');
  if (record.type === 'noul') {
    return { type: 'noul', noul: finiteNumber(record.noul, 'noul') };
  }
  if (record.type === 'choice') {
    if (typeof record.choice !== 'string' || record.choice.trim() === '')
      fail('choice is required');
    return {
      type: 'choice',
      choice: record.choice,
      probabilities: probabilityMap(record.probabilities),
      confidence: finiteNumber(record.confidence, 'confidence'),
    };
  }
  if (record.type === 'score') {
    const legendRecord = asRecord(record.legend, 'legend must be an object');
    const legend: Record<string, string> = {};
    for (const [key, label] of Object.entries(legendRecord)) {
      if (typeof label !== 'string') fail(`legend.${key} must be a string`);
      legend[key] = label;
    }
    const rawScore = finiteNumber(record.score, 'score');
    const numericKeys = Object.keys(legend)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    const maxLevel = numericKeys.length > 0 ? Math.max(...numericKeys) : 1;
    if (rawScore < 0 || rawScore > maxLevel + 1e-6) fail(`score must be between 0 and ${maxLevel}`);

    return {
      type: 'score',
      score: Math.min(1, rawScore / Math.max(maxLevel, 1)),
      legend,
      probabilities: probabilityMap(record.probabilities),
      confidence: finiteNumber(record.confidence, 'confidence'),
    };
  }
  fail(`unsupported decision answer type: ${String(record.type)}`);
}

type Signals = {
  icpFit: number;
  websiteNeed: number;
  commercialOpportunity: number;
  contactability: number;
  buyingSignals: number;
  risk: number;
};

function unitInterval(answer: SdrDecisionAnswer, field: string): number {
  const value = answer.type === 'noul' ? answer.noul : answer.type === 'score' ? answer.score : NaN;
  if (!Number.isFinite(value) || value < 0 || value > 1) fail(`${field} must be between 0 and 1`);
  return value;
}

function percent(value: number): number {
  return Math.round(value * 100);
}

export function opportunityScoreV1(signals: Signals): number {
  const icp = percent(signals.icpFit);
  const website = percent(signals.websiteNeed);
  const commercial = percent(signals.commercialOpportunity);
  const contact = percent(signals.contactability);
  const buying = percent(signals.buyingSignals);
  const risk = percent(signals.risk);
  return (30 * icp + 20 * website + 20 * commercial + 15 * contact + 15 * buying - 25 * risk) / 100;
}

function qualify(score: number, signals: Signals): Qualification {
  const risk = percent(signals.risk);
  if (risk >= 80) return 'REVIEW';
  if (score >= 55 && percent(signals.icpFit) >= 50 && percent(signals.contactability) >= 50) {
    return 'QUALIFIED';
  }
  if (score < 35) return 'REJECTED';
  return 'REVIEW';
}

function parseSignals(answers: unknown): Signals {
  const record = asRecord(answers, 'answers must be an object');
  const icpFit = parseLayaAnswer(record.icpFit);
  const websiteNeed = parseLayaAnswer(record.websiteNeed);
  const commercialOpportunity = parseLayaAnswer(record.commercialOpportunity);
  const contactability = parseLayaAnswer(record.contactability);
  const buyingSignals = parseLayaAnswer(record.buyingSignals);
  const risk = parseLayaAnswer(record.risk);
  const strategy = parseLayaAnswer(record.strategy);
  const intent = parseLayaAnswer(record.intent);
  parseLayaAnswer(record.businessActivity);
  if (icpFit.type !== 'score' || commercialOpportunity.type !== 'score' || risk.type !== 'score') {
    fail('score answers are required');
  }
  if (
    websiteNeed.type !== 'noul' ||
    contactability.type !== 'noul' ||
    buyingSignals.type !== 'noul'
  ) {
    fail('noul answers are required');
  }
  if (strategy.type !== 'choice' || !STRATEGY_CHOICES.has(strategy.choice)) {
    fail('strategy choice is not allowed');
  }
  if (intent.type !== 'choice' || !INTENT_CHOICES.has(intent.choice)) {
    fail('intent choice is not allowed');
  }
  return {
    icpFit: unitInterval(icpFit, 'icpFit'),
    websiteNeed: unitInterval(websiteNeed, 'websiteNeed'),
    commercialOpportunity: unitInterval(commercialOpportunity, 'commercialOpportunity'),
    contactability: unitInterval(contactability, 'contactability'),
    buyingSignals: unitInterval(buyingSignals, 'buyingSignals'),
    risk: unitInterval(risk, 'risk'),
  };
}

export class SdrDecisionLog {
  private readonly records: DecisionRecord[] = [];

  append(record: DecisionRecord): void {
    this.records.push(record);
  }

  read(organizationId: string): DecisionRecord[] {
    return this.records.filter((record) => record.organizationId === organizationId);
  }
}

export type ProspectJudgeFacts = {
  name?: string | null;
  tradeName?: string | null;
  companyName?: string | null;
  category?: string | null;
  segment?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
  domain?: string | null;
  hasWebsite?: boolean;
  rating?: number | null;
  reviewCount?: number | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  hasPhone?: boolean;
  hasEmail?: boolean;
  hasWhatsapp?: boolean;
  [key: string]: unknown;
};

export function extractCleanDomain(input?: string | null): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const hostname = new URL(withScheme).hostname;
    return hostname.replace(/^www\./i, '').toLowerCase() || null;
  } catch {
    return null;
  }
}

export function buildProspectJudgeState(facts: ProspectJudgeFacts): string {
  const name = facts.name?.trim() || facts.tradeName?.trim() || facts.companyName?.trim();
  if (!name) {
    throw new InvalidSdrDecisionError('Prospect essential facts missing: business name is required');
  }

  const category = facts.segment?.trim() || facts.category?.trim();
  const categoryStr = category ? `Categoria: ${category}.` : 'Categoria: não informada.';

  const city = facts.city?.trim();
  const stateUf = facts.state?.trim();
  let cityStr = 'Cidade: não informada.';
  if (city && stateUf) {
    cityStr = `Cidade: ${city}/${stateUf}.`;
  } else if (city) {
    cityStr = `Cidade: ${city}.`;
  } else if (stateUf) {
    cityStr = `Cidade: ${stateUf}.`;
  }

  const domain = extractCleanDomain(facts.domain ?? facts.website);
  const hasWebsite =
    facts.hasWebsite !== undefined
      ? Boolean(facts.hasWebsite)
      : Boolean(domain || facts.website?.trim());
  const siteStr = hasWebsite
    ? domain
      ? `Site: sim (${domain}).`
      : 'Site: sim.'
    : 'Site: não.';

  let ratingStr = 'Avaliação: não informada.';
  const hasRating = facts.rating != null && Number.isFinite(facts.rating);
  const hasReviews = facts.reviewCount != null && Number.isFinite(facts.reviewCount);
  if (hasRating && hasReviews) {
    const formatted = String(facts.rating).replace('.', ',');
    ratingStr = `Avaliação: ${formatted} (${facts.reviewCount}).`;
  } else if (hasRating) {
    const formatted = String(facts.rating).replace('.', ',');
    ratingStr = `Avaliação: ${formatted}.`;
  } else if (hasReviews) {
    ratingStr = `Avaliação: não informada (${facts.reviewCount} avaliações).`;
  }

  const hasPhone =
    facts.hasPhone !== undefined ? Boolean(facts.hasPhone) : Boolean(facts.phone?.trim());
  const hasEmail =
    facts.hasEmail !== undefined ? Boolean(facts.hasEmail) : Boolean(facts.email?.trim());
  const hasWhatsapp =
    facts.hasWhatsapp !== undefined ? Boolean(facts.hasWhatsapp) : Boolean(facts.whatsapp?.trim());

  const contactStr = `Contato: telefone ${hasPhone ? 'sim' : 'não'}, e-mail ${hasEmail ? 'sim' : 'não'}, WhatsApp ${hasWhatsapp ? 'sim' : 'não'}.`;

  return `Negócio: ${name}. ${categoryStr} ${cityStr} ${siteStr} ${ratingStr} ${contactStr}`;
}

export type JudgeProspectInput = {
  log: SdrDecisionLog;
  provider: SdrDecisionProvider;
  organizationId: string;
  campaignId: string;
  prospectId: string;
  traceId: string;
  recordedAt: string;
  untrustedText: string;
  facts?: ProspectJudgeFacts | null;
  loadFacts?: (organizationId: string, prospectId: string) => Promise<ProspectJudgeFacts | null>;
};

export async function judgeProspect(input: JudgeProspectInput): Promise<DecisionRecord> {
  let qualification: Qualification = 'REJECTED';
  let opportunityScore: number | null = null;
  let failure: string | null = null;
  try {
    let facts = input.facts ?? null;
    if (!facts && input.loadFacts) {
      facts = await input.loadFacts(input.organizationId, input.prospectId);
    }

    if (!facts) {
      qualification = 'REJECTED';
      opportunityScore = null;
      failure = 'prospect essential facts missing: facts not provided';
    } else {
      const state = buildProspectJudgeState(facts);
      const response = asRecord(
        await input.provider.judge(state),
        'provider response',
      );
      const signals = parseSignals(response.answers);
      opportunityScore = opportunityScoreV1(signals);
      qualification = qualify(opportunityScore, signals);
    }
  } catch (error) {
    qualification = 'REJECTED';
    opportunityScore = null;
    failure = error instanceof Error ? error.message : 'decision failed';
  }
  const record: DecisionRecord = {
    organizationId: input.organizationId,
    campaignId: input.campaignId,
    prospectId: input.prospectId,
    traceId: input.traceId,
    recordedAt: input.recordedAt,
    ruleVersion: OPPORTUNITY_SCORE_VERSION,
    qualification,
    opportunityScore,
    untrustedText: input.untrustedText,
    failure,
  };
  input.log.append(record);
  return record;
}

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

export type JevAnswer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

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

export interface JevDecisionProvider {
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

export function parseJevAnswer(payload: unknown): JevAnswer {
  const record = asRecord(payload, 'Jev answer must be an object');
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
    return {
      type: 'score',
      score: finiteNumber(record.score, 'score'),
      legend,
      probabilities: probabilityMap(record.probabilities),
      confidence: finiteNumber(record.confidence, 'confidence'),
    };
  }
  fail(`unsupported Jev answer type: ${String(record.type)}`);
}

type Signals = {
  icpFit: number;
  websiteNeed: number;
  commercialOpportunity: number;
  contactability: number;
  buyingSignals: number;
  risk: number;
};

function unitInterval(answer: JevAnswer, field: string): number {
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
  const icpFit = parseJevAnswer(record.icpFit);
  const websiteNeed = parseJevAnswer(record.websiteNeed);
  const commercialOpportunity = parseJevAnswer(record.commercialOpportunity);
  const contactability = parseJevAnswer(record.contactability);
  const buyingSignals = parseJevAnswer(record.buyingSignals);
  const risk = parseJevAnswer(record.risk);
  const strategy = parseJevAnswer(record.strategy);
  const intent = parseJevAnswer(record.intent);
  parseJevAnswer(record.businessActivity);
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

export type JudgeProspectInput = {
  log: SdrDecisionLog;
  provider: JevDecisionProvider;
  organizationId: string;
  campaignId: string;
  prospectId: string;
  traceId: string;
  recordedAt: string;
  untrustedText: string;
};

export async function judgeProspect(input: JudgeProspectInput): Promise<DecisionRecord> {
  let qualification: Qualification = 'REJECTED';
  let opportunityScore: number | null = null;
  let failure: string | null = null;
  try {
    const response = asRecord(
      await input.provider.judge({ prospectId: input.prospectId }),
      'provider response',
    );
    const signals = parseSignals(response.answers);
    opportunityScore = opportunityScoreV1(signals);
    qualification = qualify(opportunityScore, signals);
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

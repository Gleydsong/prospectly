export type ScoreDimension = 'fit' | 'opportunity' | 'engagement';

export type ScoreRuleKey =
  | 'NO_WEBSITE'
  | 'NO_HTTPS'
  | 'NOT_RESPONSIVE'
  | 'SLOW'
  | 'NO_CONTACT_FORM'
  | 'NO_META_DESCRIPTION'
  | 'MANY_REVIEWS_BAD_SITE'
  | 'HAS_PHONE'
  | 'HAS_EMAIL'
  | 'HIGH_RATING'
  | 'ENGAGEMENT_CONTACTED'
  | 'ENGAGEMENT_RESPONDED'
  | 'ENGAGEMENT_MEETING'
  | 'ENGAGEMENT_PROPOSAL'
  | 'ENGAGEMENT_NEGOTIATION'
  | 'ENGAGEMENT_WON'
  | 'ENGAGEMENT_ACTIVITY';

export interface DefaultScoreRule {
  key: ScoreRuleKey;
  description: string;
  points: number;
  dimension: ScoreDimension;
}

/** Catalog of predefined rules — organizations may only toggle/edit points. */
export const DEFAULT_SCORE_RULES: readonly DefaultScoreRule[] = [
  {
    key: 'NO_WEBSITE',
    points: 30,
    dimension: 'opportunity',
    description: 'Website não informado (oportunidade)',
  },
  { key: 'NO_HTTPS', points: 15, dimension: 'opportunity', description: 'Website sem HTTPS' },
  { key: 'NOT_RESPONSIVE', points: 20, dimension: 'opportunity', description: 'Website não responsivo' },
  { key: 'SLOW', points: 10, dimension: 'opportunity', description: 'Performance baixa' },
  { key: 'NO_CONTACT_FORM', points: 8, dimension: 'opportunity', description: 'Sem formulário de contato' },
  { key: 'NO_META_DESCRIPTION', points: 5, dimension: 'opportunity', description: 'Sem meta description' },
  {
    key: 'MANY_REVIEWS_BAD_SITE',
    points: 15,
    dimension: 'opportunity',
    description: 'Muitas avaliações e site ruim',
  },
  { key: 'HAS_PHONE', points: 5, dimension: 'fit', description: 'Telefone disponível' },
  { key: 'HAS_EMAIL', points: 5, dimension: 'fit', description: 'E-mail disponível' },
  { key: 'HIGH_RATING', points: 5, dimension: 'fit', description: 'Nota alta' },
  {
    key: 'ENGAGEMENT_CONTACTED',
    points: 4,
    dimension: 'engagement',
    description: 'Lead contactado',
  },
  {
    key: 'ENGAGEMENT_RESPONDED',
    points: 6,
    dimension: 'engagement',
    description: 'Lead respondeu',
  },
  {
    key: 'ENGAGEMENT_MEETING',
    points: 8,
    dimension: 'engagement',
    description: 'Reunião agendada',
  },
  {
    key: 'ENGAGEMENT_PROPOSAL',
    points: 8,
    dimension: 'engagement',
    description: 'Proposta enviada',
  },
  {
    key: 'ENGAGEMENT_NEGOTIATION',
    points: 6,
    dimension: 'engagement',
    description: 'Em negociação',
  },
  { key: 'ENGAGEMENT_WON', points: 10, dimension: 'engagement', description: 'Lead ganho' },
  {
    key: 'ENGAGEMENT_ACTIVITY',
    points: 4,
    dimension: 'engagement',
    description: 'Atividade comercial registrada',
  },
] as const;

export const SCORE_RULE_KEYS = DEFAULT_SCORE_RULES.map((rule) => rule.key);

export const RULE_DIMENSION_BY_KEY: Record<ScoreRuleKey, ScoreDimension> = Object.fromEntries(
  DEFAULT_SCORE_RULES.map((rule) => [rule.key, rule.dimension]),
) as Record<ScoreRuleKey, ScoreDimension>;

export const SCORE_POINTS_MIN = 0;
export const SCORE_POINTS_MAX = 50;
export const SCORE_TOTAL_CAP = 100;

export const SLOW_RESPONSE_MS = 3000;
export const HIGH_RATING_THRESHOLD = 4;
export const MANY_REVIEWS_THRESHOLD = 20;

export const RECALC_BATCH_SIZE = 200;
export const RECALC_CONCURRENCY = 5;

export type ScoreTier = 'LOW' | 'MEDIUM' | 'GOOD' | 'HIGH';

export function scoreToTier(score: number): ScoreTier {
  if (score < 30) return 'LOW';
  if (score < 60) return 'MEDIUM';
  if (score < 80) return 'GOOD';
  return 'HIGH';
}

export type RecommendedAction =
  | 'RESPECT_DNC'
  | 'ENRICH_CONTACT'
  | 'RUN_WEBSITE_ANALYSIS'
  | 'PRIORITIZE_OUTREACH'
  | 'ADVANCE_PIPELINE'
  | 'ENRICH_PROFILE'
  | 'NURTURE';

export const SCORING_QUEUE = 'scoring';
export const RECALCULATE_ORG_SCORES_JOB = 'recalculate-org-scores';

export type RecalculateOrgScoresJobData = {
  organizationId: string;
  correlationId?: string;
};

export type AppliedScoreRule = {
  key: string;
  points: number;
  dimension: ScoreDimension;
};

export type EvaluateRulesResult = {
  applied: AppliedScoreRule[];
  fit: number;
  opportunity: number;
  engagement: number;
  score: number;
  tier: ScoreTier;
  missingData: string[];
  recommendedAction: RecommendedAction;
};

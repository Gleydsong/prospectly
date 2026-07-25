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
  | 'HIGH_RATING';

export interface DefaultScoreRule {
  key: ScoreRuleKey;
  description: string;
  points: number;
}

/** Catalog of predefined rules — organizations may only toggle/edit points. */
export const DEFAULT_SCORE_RULES: readonly DefaultScoreRule[] = [
  { key: 'NO_WEBSITE', points: 30, description: 'Sem website' },
  { key: 'NO_HTTPS', points: 15, description: 'Website sem HTTPS' },
  { key: 'NOT_RESPONSIVE', points: 20, description: 'Website não responsivo' },
  { key: 'SLOW', points: 10, description: 'Performance baixa' },
  { key: 'NO_CONTACT_FORM', points: 8, description: 'Sem formulário de contato' },
  { key: 'NO_META_DESCRIPTION', points: 5, description: 'Sem meta description' },
  { key: 'MANY_REVIEWS_BAD_SITE', points: 15, description: 'Muitas avaliações e site ruim' },
  { key: 'HAS_PHONE', points: 5, description: 'Telefone disponível' },
  { key: 'HAS_EMAIL', points: 5, description: 'E-mail disponível' },
  { key: 'HIGH_RATING', points: 5, description: 'Nota alta' },
] as const;

export const SCORE_RULE_KEYS = DEFAULT_SCORE_RULES.map((rule) => rule.key);

export const SCORE_POINTS_MIN = 0;
export const SCORE_POINTS_MAX = 50;
export const SCORE_TOTAL_CAP = 100;

export const SLOW_RESPONSE_MS = 3000;
export const HIGH_RATING_THRESHOLD = 4;
export const MANY_REVIEWS_THRESHOLD = 20;

export type ScoreTier = 'LOW' | 'MEDIUM' | 'GOOD' | 'HIGH';

export function scoreToTier(score: number): ScoreTier {
  if (score < 30) return 'LOW';
  if (score < 60) return 'MEDIUM';
  if (score < 80) return 'GOOD';
  return 'HIGH';
}

export const SCORING_QUEUE = 'scoring';
export const RECALCULATE_ORG_SCORES_JOB = 'recalculate-org-scores';

export type RecalculateOrgScoresJobData = {
  organizationId: string;
};

export const OPPORTUNITY_FINDER_QUEUE = 'opportunity-finder';
export const PROCESS_OPPORTUNITY_RUN_JOB = 'process-opportunity-run';

export const OPPORTUNITY_SCORE_VERSION = 'opportunity-score-v1' as const;
export const OPPORTUNITY_PROFILE_PROMPT_VERSION = 'opportunity-profile:v2';
export const OPPORTUNITY_STRATEGY_PROMPT_VERSION = 'search-strategy:v2';
export const OPPORTUNITY_EXPLANATION_PROMPT_VERSION = 'opportunity-explanation:v1';

export const OPPORTUNITY_LIMITS = {
  maxCandidates: 20,
  maxWebsiteAnalyses: 20,
  maxAiExplanations: 5,
  analysisConcurrency: 4,
  maxServiceLength: 240,
  maxDurationMs: 120_000,
} as const;

export interface ProcessOpportunityRunJobData {
  runId: string;
  correlationId?: string;
}

export const OPPORTUNITY_JOB_OPTIONS = {
  attempts: 2,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: 100,
  removeOnFail: 200,
} as const;

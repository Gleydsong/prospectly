export const WEBSITE_ANALYSIS_QUEUE = 'website-analysis';
export const ANALYZE_WEBSITE_JOB = 'analyze-website';

export type AnalyzeWebsiteJobData = {
  organizationId: string;
  leadId: string;
  analysisId: string;
  url: string;
  correlationId?: string;
};

export const WEBSITE_ANALYSIS_TIMEOUT_MS = 10_000;
export const WEBSITE_ANALYSIS_MAX_BODY_BYTES = 1_500_000;
export const WEBSITE_ANALYSIS_MAX_REDIRECTS = 5;
export const WEBSITE_ANALYSIS_USER_AGENT =
  'ProspectlyWebsiteAnalyzer/1.0 (+https://prospectly.dev)';

export const WEBSITE_ANALYSIS_JOB_OPTIONS = {
  removeOnComplete: 100,
  removeOnFail: 50,
  attempts: 2,
  backoff: { type: 'exponential' as const, delay: 2000 },
};

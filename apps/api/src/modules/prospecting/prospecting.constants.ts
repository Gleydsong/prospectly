export const PROSPECTING_QUEUE = 'prospecting';
export const RUN_SEARCH_JOB = 'run-search';

export interface RunSearchJobData {
  searchId: string;
  correlationId?: string;
}

export const PROSPECTING_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1_000 },
  removeOnComplete: 100,
  removeOnFail: 500,
} as const;

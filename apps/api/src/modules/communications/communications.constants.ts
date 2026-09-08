export const GMAIL_SYNC_QUEUE = 'gmail-sync';
export const SYNC_GMAIL_CONNECTION_JOB = 'sync-gmail-connection';
export const SWEEP_GMAIL_CONNECTIONS_JOB = 'sweep-gmail-connections';

export type SyncGmailConnectionJobData = {
  organizationId: string;
  connectionId: string;
  correlationId?: string;
};

export const GMAIL_SYNC_JOB_OPTIONS = {
  removeOnComplete: 100,
  removeOnFail: 50,
  attempts: 2,
  backoff: { type: 'exponential' as const, delay: 5000 },
};

export const GMAIL_BACKFILL_MS = 30 * 24 * 60 * 60 * 1000;
export const GMAIL_INCREMENTAL_OVERLAP_MS = 60 * 60 * 1000;
export const GMAIL_SYNC_MAX_MESSAGES = 250;
export const GMAIL_SWEEP_EVERY_MS = 15 * 60 * 1000;
export const CALENDAR_SYNC_MAX_EVENTS = 250;
export const CALENDAR_FUTURE_WINDOW_MS = 180 * 24 * 60 * 60 * 1000;

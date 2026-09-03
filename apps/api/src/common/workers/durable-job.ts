/** BullMQ jobIds collide with this message when Redis still holds the job. */
const DUPLICATE_JOB_RE = /already exists/i;

export const SEARCH_JOB_STALE_MS = 15 * 60 * 1000;
export const IMPORT_JOB_STALE_MS = 15 * 60 * 1000;
export const OPPORTUNITY_JOB_STALE_MS = 5 * 60 * 1000;
export const WEBSITE_ANALYSIS_JOB_STALE_MS = 10 * 60 * 1000;

export function isDuplicateJobError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return DUPLICATE_JOB_RE.test(message);
}

export function staleBefore(staleMs: number, now = Date.now()): Date {
  return new Date(now - staleMs);
}

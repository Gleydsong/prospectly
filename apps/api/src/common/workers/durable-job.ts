/** BullMQ jobIds collide with this message when Redis still holds the job. */
const DUPLICATE_JOB_RE = /already exists/i;

export const SEARCH_JOB_STALE_MS = 15 * 60 * 1000;
export const IMPORT_JOB_STALE_MS = 15 * 60 * 1000;
export const OPPORTUNITY_JOB_STALE_MS = 5 * 60 * 1000;
export const WEBSITE_ANALYSIS_JOB_STALE_MS = 10 * 60 * 1000;
export const OUTBOX_JOB_STALE_MS = 2 * 60 * 1000;

export function isDuplicateJobError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return DUPLICATE_JOB_RE.test(message);
}

/** BullMQ keeps completed/failed jobs with a custom jobId; re-adding that id is a no-op. */
export type DurableJobSlot = {
  getState(): Promise<string>;
  remove(): Promise<unknown>;
};

export async function replaceFinishedDurableJob(
  job: DurableJobSlot | undefined | null,
): Promise<'free' | 'busy'> {
  if (!job) return 'free';
  const state = await job.getState();
  if (state === 'completed' || state === 'failed') {
    await job.remove();
    return 'free';
  }
  return 'busy';
}

export function staleBefore(staleMs: number, now = Date.now()): Date {
  return new Date(now - staleMs);
}

import { isDuplicateJobError, replaceFinishedDurableJob, staleBefore } from './durable-job';

describe('durable job helpers', () => {
  it('detects BullMQ duplicate jobId errors', () => {
    expect(isDuplicateJobError(new Error('Job search-1 already exists'))).toBe(true);
    expect(isDuplicateJobError(new Error('ECONNREFUSED'))).toBe(false);
  });

  it('removes completed or failed jobs so the same jobId can run again', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    await expect(
      replaceFinishedDurableJob({ getState: async () => 'completed', remove }),
    ).resolves.toBe('free');
    await expect(
      replaceFinishedDurableJob({ getState: async () => 'failed', remove }),
    ).resolves.toBe('free');
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it('leaves waiting or active jobs in place', async () => {
    const remove = jest.fn();
    await expect(
      replaceFinishedDurableJob({ getState: async () => 'active', remove }),
    ).resolves.toBe('busy');
    await expect(replaceFinishedDurableJob(undefined)).resolves.toBe('free');
    expect(remove).not.toHaveBeenCalled();
  });

  it('computes the stale watermark', () => {
    expect(staleBefore(60_000, Date.parse('2026-09-03T12:00:00.000Z')).toISOString()).toBe(
      '2026-09-03T11:59:00.000Z',
    );
  });
});

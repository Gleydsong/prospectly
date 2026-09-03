import { isDuplicateJobError, staleBefore } from './durable-job';

describe('durable job helpers', () => {
  it('detects BullMQ duplicate jobId errors', () => {
    expect(isDuplicateJobError(new Error('Job search-1 already exists'))).toBe(true);
    expect(isDuplicateJobError(new Error('ECONNREFUSED'))).toBe(false);
  });

  it('computes the stale watermark', () => {
    expect(staleBefore(60_000, Date.parse('2026-09-03T12:00:00.000Z')).toISOString()).toBe(
      '2026-09-03T11:59:00.000Z',
    );
  });
});

import { PRISMA_WORKER_CONNECTION_LIMIT } from '../../common/prisma/prisma-pool';
import { OUTBOX_PROCESSOR_OPTIONS, OUTBOX_WORKER_CONCURRENCY } from './outbox.constants';

describe('outbox worker concurrency', () => {
  it('caps concurrent outbox jobs below the worker Prisma pool', () => {
    expect(OUTBOX_WORKER_CONCURRENCY).toBe(2);
    expect(OUTBOX_PROCESSOR_OPTIONS.concurrency).toBe(OUTBOX_WORKER_CONCURRENCY);
    expect(OUTBOX_WORKER_CONCURRENCY).toBeLessThan(PRISMA_WORKER_CONNECTION_LIMIT);
  });
});

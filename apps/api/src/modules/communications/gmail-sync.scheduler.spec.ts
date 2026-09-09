import { GmailSyncScheduler } from './gmail-sync.scheduler';

describe('GmailSyncScheduler', () => {
  it('enqueues a boot sweep and a 15m repeat without a payload body', async () => {
    const queue = {
      add: jest.fn().mockResolvedValue(undefined),
      getJob: jest.fn().mockResolvedValue(undefined),
    };
    const scheduler = new GmailSyncScheduler(queue as never);
    await scheduler.onModuleInit();
    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add.mock.calls[0][0]).toBe('sweep-gmail-connections');
    expect(queue.add.mock.calls[0][2]).toEqual(
      expect.objectContaining({ jobId: 'sweep-gmail-connections-boot' }),
    );
    expect(queue.add.mock.calls[1][2]).toEqual(
      expect.objectContaining({
        jobId: 'sweep-gmail-connections',
        repeat: { every: 15 * 60 * 1000 },
      }),
    );
    expect(JSON.stringify(queue.add.mock.calls)).not.toContain('snippet');
  });

  it('replaces a completed boot sweep so a deploy actually runs again', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    const queue = {
      add: jest.fn().mockResolvedValue(undefined),
      getJob: jest.fn().mockResolvedValue({ getState: async () => 'completed', remove }),
    };
    const scheduler = new GmailSyncScheduler(queue as never);
    await scheduler.onModuleInit();
    expect(remove).toHaveBeenCalled();
    expect(queue.add.mock.calls[0][2]).toEqual(
      expect.objectContaining({ jobId: 'sweep-gmail-connections-boot' }),
    );
  });
});

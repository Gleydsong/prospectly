import { OpportunityFinderDispatchReconciler } from './opportunity-finder-dispatch.reconciler';

describe('OpportunityFinderDispatchReconciler', () => {
  it('runs at startup and continues after a failed reconciliation pass', async () => {
    jest.useFakeTimers();
    const service = {
      reconcilePending: jest
        .fn()
        .mockRejectedValueOnce(new Error('redis unavailable'))
        .mockResolvedValue(1),
    };
    const reconciler = new OpportunityFinderDispatchReconciler(service as never, 5_000);

    try {
      reconciler.onApplicationBootstrap();
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(5_000);
      expect(service.reconcilePending).toHaveBeenCalledTimes(2);
    } finally {
      reconciler.onModuleDestroy();
      jest.useRealTimers();
    }
  });
});

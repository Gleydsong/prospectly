import { ImportsDispatchReconciler } from './imports-dispatch.reconciler';

describe('ImportsDispatchReconciler', () => {
  it('runs at startup and repeats reconciliation on the configured interval', async () => {
    jest.useFakeTimers();
    const service = { reconcilePending: jest.fn().mockResolvedValue(1) };
    const reconciler = new ImportsDispatchReconciler(service as never, 5_000);

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

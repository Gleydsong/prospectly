import { gracefulShutdown, DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS } from './graceful-shutdown';

describe('gracefulShutdown', () => {
  it('closes the Nest context and logs completion', async () => {
    const close = jest.fn().mockResolvedValue(undefined);
    const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const onForceExit = jest.fn();

    await gracefulShutdown({ close } as never, 'SIGTERM', {
      timeoutMs: 1_000,
      logger,
      onForceExit,
    });

    expect(close).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Received SIGTERM'),
    );
    expect(logger.log).toHaveBeenCalledWith('Worker shutdown complete');
    expect(onForceExit).not.toHaveBeenCalled();
  });

  it('forces exit when close rejects', async () => {
    const close = jest.fn().mockRejectedValue(new Error('boom'));
    const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const onForceExit = jest.fn();

    await gracefulShutdown({ close } as never, 'SIGINT', {
      timeoutMs: 1_000,
      logger,
      onForceExit,
    });

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
    expect(onForceExit).toHaveBeenCalledWith(1);
  });

  it('uses default timeout constant', () => {
    expect(DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS).toBe(30_000);
  });
});

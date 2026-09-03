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

  it('honors WORKER_SHUTDOWN_TIMEOUT_MS when options omit timeoutMs', async () => {
    const previous = process.env.WORKER_SHUTDOWN_TIMEOUT_MS;
    process.env.WORKER_SHUTDOWN_TIMEOUT_MS = '25';
    jest.useFakeTimers();
    const close = jest.fn().mockReturnValue(new Promise(() => undefined));
    const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const onForceExit = jest.fn();

    try {
      void gracefulShutdown({ close } as never, 'SIGTERM', { logger, onForceExit });
      await jest.advanceTimersByTimeAsync(24);
      expect(onForceExit).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      expect(logger.error).toHaveBeenCalledWith(
        'Graceful shutdown timed out after 25ms; forcing exit',
      );
      expect(onForceExit).toHaveBeenCalledWith(1);
    } finally {
      jest.useRealTimers();
      if (previous === undefined) {
        delete process.env.WORKER_SHUTDOWN_TIMEOUT_MS;
      } else {
        process.env.WORKER_SHUTDOWN_TIMEOUT_MS = previous;
      }
    }
  });
});

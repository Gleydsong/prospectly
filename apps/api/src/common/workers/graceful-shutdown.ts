import type { INestApplicationContext, LoggerService } from '@nestjs/common';

export const DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS = 30_000;

export type GracefulShutdownOptions = {
  timeoutMs?: number;
  logger?: Pick<LoggerService, 'log' | 'error' | 'warn'>;
  onForceExit?: (code: number) => void;
};

/**
 * Stops BullMQ intake via Nest lifecycle (workers close), waits for in-flight
 * jobs up to timeout, then closes Redis/Prisma through OnModuleDestroy hooks.
 */
export async function gracefulShutdown(
  app: INestApplicationContext,
  signal: string,
  options: GracefulShutdownOptions = {},
): Promise<void> {
  const timeoutMs =
    options.timeoutMs ??
    parsePositiveInt(process.env.WORKER_SHUTDOWN_TIMEOUT_MS) ??
    DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS;
  const logger = options.logger;
  const forceExit = options.onForceExit ?? ((code: number) => process.exit(code));

  logger?.log(`Received ${signal}; starting graceful shutdown (timeout=${timeoutMs}ms)`);

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    logger?.error(`Graceful shutdown timed out after ${timeoutMs}ms; forcing exit`);
    forceExit(1);
  }, timeoutMs);
  timeout.unref?.();

  try {
    await app.close();
    if (!timedOut) {
      logger?.log('Worker shutdown complete');
    }
  } catch (error) {
    logger?.error(
      `Worker shutdown failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    if (!timedOut) {
      forceExit(1);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return undefined;
  return parsed;
}

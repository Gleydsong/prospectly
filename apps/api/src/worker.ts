import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';

import { gracefulShutdown } from './common/workers/graceful-shutdown';
import { WorkerModule } from './worker.module';

process.env.ROLE = 'worker';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();

  const logger = new Logger('WorkerBootstrap');
  logger.log('BullMQ worker context started (no HTTP listener)');

  let shuttingDown = false;
  const onSignal = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    void gracefulShutdown(app, signal, { logger }).then(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(`Worker failed to start: ${message}`);
  process.exit(1);
});

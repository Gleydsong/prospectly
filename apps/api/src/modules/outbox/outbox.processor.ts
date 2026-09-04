import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { runWithTenant } from '../../common/prisma/tenant-context';
import { MetricsService } from '../ops/metrics.service';
import { OUTBOX_QUEUE, PUBLISH_OUTBOX_JOB, type PublishOutboxJobData } from './outbox.constants';
import { OutboxService } from './outbox.service';

@Processor(OUTBOX_QUEUE)
export class OutboxProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    private readonly outbox: OutboxService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<PublishOutboxJobData>): Promise<void> {
    if (job.name !== PUBLISH_OUTBOX_JOB) {
      this.logger.warn(`Ignoring unknown outbox job ${job.name}`);
      return;
    }

    const correlationId = job.data.correlationId ?? 'unknown';
    const started = Date.now();
    try {
      await runWithTenant(job.data.organizationId, () => this.outbox.process(job.data.eventId));
      this.metrics.recordJob(OUTBOX_QUEUE, 'completed', Date.now() - started);
    } catch (error) {
      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;
      this.metrics.recordJob(
        OUTBOX_QUEUE,
        isFinalAttempt ? 'failed' : 'retry',
        Date.now() - started,
      );
      this.logger.error({
        message: 'Outbox publish failed',
        organizationId: job.data.organizationId,
        eventId: job.data.eventId,
        correlationId,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

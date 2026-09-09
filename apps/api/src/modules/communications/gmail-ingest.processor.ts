import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { runWithTenant } from '../../common/prisma/tenant-context';
import { MetricsService } from '../ops/metrics.service';
import {
  GMAIL_SYNC_QUEUE,
  SWEEP_GMAIL_CONNECTIONS_JOB,
  SYNC_GMAIL_CONNECTION_JOB,
  type SyncGmailConnectionJobData,
} from './communications.constants';
import { GmailIngestService } from './gmail-ingest.service';

@Processor(GMAIL_SYNC_QUEUE)
export class GmailIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(GmailIngestProcessor.name);

  constructor(
    private readonly ingest: GmailIngestService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<SyncGmailConnectionJobData | Record<string, never>>): Promise<void> {
    if (job.name === SWEEP_GMAIL_CONNECTIONS_JOB) {
      await this.ingest.sweepActiveConnections();
      return;
    }
    if (job.name !== SYNC_GMAIL_CONNECTION_JOB) {
      this.logger.warn(`Ignoring unknown gmail sync job ${job.name}`);
      return;
    }
    const data = job.data as SyncGmailConnectionJobData;
    const started = Date.now();
    try {
      await runWithTenant(data.organizationId, () =>
        this.ingest.syncConnection(data.organizationId, data.connectionId),
      );
      this.metrics.recordJob(GMAIL_SYNC_QUEUE, 'completed', Date.now() - started);
      this.logger.log({
        message: 'Gmail sync completed',
        organizationId: data.organizationId,
        connectionId: data.connectionId,
      });
    } catch (error) {
      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;
      this.metrics.recordJob(
        GMAIL_SYNC_QUEUE,
        isFinalAttempt ? 'failed' : 'retry',
        Date.now() - started,
      );
      this.logger.warn({
        message: 'Gmail sync failed',
        organizationId: data.organizationId,
        connectionId: data.connectionId,
        correlationId: data.correlationId ?? 'unknown',
        error: error instanceof Error ? error.message : 'unknown',
      });
      throw error;
    }
  }
}

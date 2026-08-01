import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { MetricsService } from '../ops/metrics.service';
import { IMPORTS_QUEUE, type ProcessCsvImportJobData } from './imports.constants';
import { ImportsService } from './imports.service';

@Processor(IMPORTS_QUEUE)
export class ImportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportsProcessor.name);

  constructor(
    private readonly imports: ImportsService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<ProcessCsvImportJobData>): Promise<void> {
    let context: { organizationId: string; correlationId: string | null } | null = null;
    const started = Date.now();
    try {
      context = await this.imports.getJobContext(job.data.importId);
      await this.imports.process(job.data);
      this.metrics.recordJob(IMPORTS_QUEUE, 'completed', Date.now() - started);
    } catch {
      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;
      if (isFinalAttempt) {
        await this.imports.recordFailure(job.data.importId);
      }
      this.metrics.recordJob(
        IMPORTS_QUEUE,
        isFinalAttempt ? 'failed' : 'retry',
        Date.now() - started,
      );
      this.logger.warn({
        message: 'CSV import processing failed',
        importId: job.data.importId,
        organizationId: context?.organizationId ?? 'unknown',
        correlationId: context?.correlationId ?? job.data.correlationId ?? 'unknown',
      });
      throw new Error('CSV import processing failed. Please try again later.');
    }
  }
}

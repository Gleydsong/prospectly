import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { PROSPECTING_QUEUE, type RunSearchJobData } from './prospecting.constants';
import { ProspectingService } from './prospecting.service';

@Processor(PROSPECTING_QUEUE)
export class ProspectingProcessor extends WorkerHost {
  private readonly logger = new Logger(ProspectingProcessor.name);

  constructor(private readonly prospecting: ProspectingService) {
    super();
  }

  async process(job: Job<RunSearchJobData>): Promise<void> {
    let context: { organizationId: string; correlationId: string | null } | null = null;
    try {
      context = await this.prospecting.getJobContext(job.data.searchId);
      await this.prospecting.process(job.data.searchId);
    } catch {
      const maxAttempts = job.opts.attempts ?? 1;
      if (job.attemptsMade + 1 >= maxAttempts) {
        await this.prospecting.recordFailure(job.data.searchId);
      }
      this.logger.warn({
        message: 'Search processing failed',
        searchId: job.data.searchId,
        organizationId: context?.organizationId ?? 'unknown',
        correlationId: context?.correlationId ?? job.data.correlationId ?? 'unknown',
      });
      throw new Error('Search processing failed. Please try again later.');
    }
  }
}

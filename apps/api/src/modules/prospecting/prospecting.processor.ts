import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { UnrecoverableError, type Job } from 'bullmq';

import { isSearchProviderError } from './domain/search-provider-error';
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
    } catch (error) {
      const permanent = isSearchProviderError(error) && !error.retryable;
      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = permanent || job.attemptsMade + 1 >= maxAttempts;

      if (isFinalAttempt) {
        await this.prospecting.recordFailure(
          job.data.searchId,
          isSearchProviderError(error) ? error.publicMessage : undefined,
        );
      }

      this.logger.warn({
        message: 'Search processing failed',
        searchId: job.data.searchId,
        organizationId: context?.organizationId ?? 'unknown',
        correlationId: context?.correlationId ?? job.data.correlationId ?? 'unknown',
        ...(isSearchProviderError(error)
          ? {
              provider: error.provider,
              statusCode: error.statusCode,
              reason: error.reason,
              retryable: error.retryable,
            }
          : {}),
      });

      if (permanent) {
        throw new UnrecoverableError(
          isSearchProviderError(error)
            ? error.publicMessage
            : 'Search processing failed. Please try again later.',
        );
      }

      throw new Error('Search processing failed. Please try again later.');
    }
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import {
  PRIVACY_RETENTION_QUEUE,
  PROCESS_PRIVACY_RETENTION_JOB,
} from './retention.constants';
import { RetentionService } from './retention.service';

@Processor(PRIVACY_RETENTION_QUEUE)
export class RetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(RetentionProcessor.name);

  constructor(private readonly retention: RetentionService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== PROCESS_PRIVACY_RETENTION_JOB) return;
    try {
      await this.retention.run();
    } catch (error) {
      this.logger.warn({
        message: 'Privacy retention job failed',
        error: error instanceof Error ? error.message : 'unknown',
      });
      throw error;
    }
  }
}

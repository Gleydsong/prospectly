import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { MetricsService } from '../ops/metrics.service';
import {
  RECALCULATE_ORG_SCORES_JOB,
  SCORING_QUEUE,
  type RecalculateOrgScoresJobData,
} from './scoring.constants';
import { ScoringService } from './scoring.service';

@Processor(SCORING_QUEUE)
export class ScoringProcessor extends WorkerHost {
  private readonly logger = new Logger(ScoringProcessor.name);

  constructor(
    private readonly scoring: ScoringService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<RecalculateOrgScoresJobData>): Promise<void> {
    if (job.name !== RECALCULATE_ORG_SCORES_JOB) {
      this.logger.warn(`Ignoring unknown scoring job ${job.name}`);
      return;
    }

    const correlationId = job.data.correlationId ?? 'unknown';
    const started = Date.now();
    try {
      const count = await this.scoring.recalculateOrganization(job.data.organizationId);
      this.metrics.recordJob(SCORING_QUEUE, 'completed', Date.now() - started);
      this.logger.log({
        message: 'Recalculated organization scores',
        organizationId: job.data.organizationId,
        leadCount: count,
        correlationId,
      });
    } catch (error) {
      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;
      this.metrics.recordJob(
        SCORING_QUEUE,
        isFinalAttempt ? 'failed' : 'retry',
        Date.now() - started,
      );
      this.logger.warn({
        message: 'Scoring recalculation failed',
        organizationId: job.data.organizationId,
        correlationId,
      });
      throw error;
    }
  }
}

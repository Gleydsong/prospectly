import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { MetricsService } from '../../ops/metrics.service';
import {
  GENERATE_LANDING_JOB,
  LANDING_GENERATION_QUEUE,
  REFINE_LANDING_JOB,
  type GenerateLandingJobData,
  type RefineLandingJobData,
} from './landing-generation.constants';
import { LandingGenerationService } from './landing-generation.service';

@Processor(LANDING_GENERATION_QUEUE)
export class LandingGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(LandingGenerationProcessor.name);

  constructor(
    private readonly generation: LandingGenerationService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<GenerateLandingJobData | RefineLandingJobData>): Promise<void> {
    const started = Date.now();
    try {
      if (job.name === GENERATE_LANDING_JOB) {
        await this.generation.processGenerate(job.data as GenerateLandingJobData);
      } else if (job.name === REFINE_LANDING_JOB) {
        await this.generation.processRefine(job.data as RefineLandingJobData);
      } else {
        this.logger.warn(`Ignoring unknown landing generation job ${job.name}`);
        return;
      }
      this.metrics.recordJob(LANDING_GENERATION_QUEUE, 'completed', Date.now() - started);
    } catch (error) {
      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;
      this.metrics.recordJob(
        LANDING_GENERATION_QUEUE,
        isFinalAttempt ? 'failed' : 'retry',
        Date.now() - started,
      );
      this.logger.error({
        message: 'Landing generation job failed',
        jobName: job.name,
        pageId: job.data.pageId,
        organizationId: job.data.organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

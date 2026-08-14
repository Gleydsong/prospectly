import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { MetricsService } from '../ops/metrics.service';
import {
  ANALYZE_WEBSITE_JOB,
  WEBSITE_ANALYSIS_QUEUE,
  type AnalyzeWebsiteJobData,
} from './website-analysis.constants';
import { WebsiteAnalysisService } from './website-analysis.service';
import { runWithTenant } from '../../common/prisma/tenant-context';

@Processor(WEBSITE_ANALYSIS_QUEUE)
export class WebsiteAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(WebsiteAnalysisProcessor.name);

  constructor(
    private readonly websiteAnalysis: WebsiteAnalysisService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<AnalyzeWebsiteJobData>): Promise<void> {
    if (job.name !== ANALYZE_WEBSITE_JOB) {
      this.logger.warn(`Ignoring unknown website analysis job ${job.name}`);
      return;
    }

    const correlationId = job.data.correlationId ?? 'unknown';
    const started = Date.now();
    try {
      await runWithTenant(job.data.organizationId, () =>
        this.websiteAnalysis.processAnalysis(job.data),
      );
      this.metrics.recordJob(WEBSITE_ANALYSIS_QUEUE, 'completed', Date.now() - started);
      this.logger.log({
        message: 'Website analysis completed',
        organizationId: job.data.organizationId,
        leadId: job.data.leadId,
        analysisId: job.data.analysisId,
        correlationId,
      });
    } catch (error) {
      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;
      this.metrics.recordJob(
        WEBSITE_ANALYSIS_QUEUE,
        isFinalAttempt ? 'failed' : 'retry',
        Date.now() - started,
      );
      this.logger.error({
        message: 'Website analysis failed',
        organizationId: job.data.organizationId,
        leadId: job.data.leadId,
        analysisId: job.data.analysisId,
        correlationId,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

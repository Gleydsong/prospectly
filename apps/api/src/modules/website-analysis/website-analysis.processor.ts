import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import {
  ANALYZE_WEBSITE_JOB,
  WEBSITE_ANALYSIS_QUEUE,
  type AnalyzeWebsiteJobData,
} from './website-analysis.constants';
import { WebsiteAnalysisService } from './website-analysis.service';

@Processor(WEBSITE_ANALYSIS_QUEUE)
export class WebsiteAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(WebsiteAnalysisProcessor.name);

  constructor(private readonly websiteAnalysis: WebsiteAnalysisService) {
    super();
  }

  async process(job: Job<AnalyzeWebsiteJobData>): Promise<void> {
    if (job.name !== ANALYZE_WEBSITE_JOB) {
      this.logger.warn(`Ignoring unknown website analysis job ${job.name}`);
      return;
    }
    try {
      await this.websiteAnalysis.processAnalysis(job.data);
    } catch (error) {
      this.logger.error(
        `Website analysis failed for lead ${job.data.leadId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}

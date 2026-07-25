import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import {
  RECALCULATE_ORG_SCORES_JOB,
  SCORING_QUEUE,
  type RecalculateOrgScoresJobData,
} from './scoring.constants';
import { ScoringService } from './scoring.service';

@Processor(SCORING_QUEUE)
export class ScoringProcessor extends WorkerHost {
  private readonly logger = new Logger(ScoringProcessor.name);

  constructor(private readonly scoring: ScoringService) {
    super();
  }

  async process(job: Job<RecalculateOrgScoresJobData>): Promise<void> {
    if (job.name !== RECALCULATE_ORG_SCORES_JOB) {
      this.logger.warn(`Ignoring unknown scoring job ${job.name}`);
      return;
    }
    const count = await this.scoring.recalculateOrganization(job.data.organizationId);
    this.logger.log(
      `Recalculated scores for ${count} leads in org ${job.data.organizationId}`,
    );
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { UnrecoverableError, type Job } from 'bullmq';

import { MetricsService } from '../ops/metrics.service';
import { OPPORTUNITY_FINDER_QUEUE, PROCESS_OPPORTUNITY_RUN_JOB, type ProcessOpportunityRunJobData } from './opportunity-finder.constants';
import { OpportunityFinderService } from './opportunity-finder.service';
import { runWithBypass, runWithTenant } from '../../common/prisma/tenant-context';

@Processor(OPPORTUNITY_FINDER_QUEUE)
export class OpportunityFinderProcessor extends WorkerHost {
  private readonly logger = new Logger(OpportunityFinderProcessor.name);

  constructor(private readonly service: OpportunityFinderService, private readonly metrics: MetricsService) { super(); }

  async process(job: Job<ProcessOpportunityRunJobData>): Promise<void> {
    if (job.name !== PROCESS_OPPORTUNITY_RUN_JOB) throw new UnrecoverableError('Unknown opportunity finder job');
    const started = Date.now();
    const context = await runWithBypass(() => this.service.getJobContext(job.data.runId));
    const withScope = <T,>(fn: () => Promise<T>): Promise<T> =>
      context?.organizationId ? runWithTenant(context.organizationId, fn) : runWithBypass(fn);
    try {
      await withScope(() => this.service.processRun(job.data.runId));
      this.metrics.recordJob(OPPORTUNITY_FINDER_QUEUE, 'completed', Date.now() - started);
    } catch (error) {
      if (error instanceof Error && error.message === 'NO_COMPANIES_FOUND') {
        await withScope(() => this.service.recordFailure(job.data.runId, 'NO_COMPANIES_FOUND'));
        this.metrics.recordJob(OPPORTUNITY_FINDER_QUEUE, 'failed', Date.now() - started);
        throw new UnrecoverableError('NO_COMPANIES_FOUND');
      }
      const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      this.metrics.recordJob(OPPORTUNITY_FINDER_QUEUE, finalAttempt ? 'failed' : 'retry', Date.now() - started);
      this.logger.error({ message: 'Opportunity run failed', runId: job.data.runId, correlationId: job.data.correlationId ?? 'unknown', error: error instanceof Error ? error.message : 'unknown' });
      if (finalAttempt) await withScope(() => this.service.recordFailure(job.data.runId, error instanceof Error ? error.message : 'PROCESSING_FAILED'));
      throw error;
    }
  }
}

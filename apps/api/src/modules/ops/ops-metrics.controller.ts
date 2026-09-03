import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Queue } from 'bullmq';

import { Public } from '../../common/decorators/public.decorator';
import { IMPORTS_QUEUE } from '../imports/imports.constants';
import { PROSPECTING_QUEUE } from '../prospecting/prospecting.constants';
import { SCORING_QUEUE } from '../scoring/scoring.constants';
import { WEBSITE_ANALYSIS_QUEUE } from '../website-analysis/website-analysis.constants';
import { OPPORTUNITY_FINDER_QUEUE } from '../opportunity-finder/opportunity-finder.constants';
import { MetricsService } from './metrics.service';
import { OpsMetricsGuard } from './ops-metrics.guard';

const OPS_QUEUES = [
  PROSPECTING_QUEUE,
  IMPORTS_QUEUE,
  SCORING_QUEUE,
  WEBSITE_ANALYSIS_QUEUE,
  OPPORTUNITY_FINDER_QUEUE,
] as const;

@ApiTags('ops')
@ApiHeader({ name: 'X-Prospectly-Ops-Token', required: true })
@Controller({ path: 'ops/metrics', version: '1' })
export class OpsMetricsController {
  constructor(
    private readonly metrics: MetricsService,
    @InjectQueue(PROSPECTING_QUEUE) private readonly prospectingQueue: Queue,
    @InjectQueue(IMPORTS_QUEUE) private readonly importsQueue: Queue,
    @InjectQueue(SCORING_QUEUE) private readonly scoringQueue: Queue,
    @InjectQueue(WEBSITE_ANALYSIS_QUEUE) private readonly websiteAnalysisQueue: Queue,
    @InjectQueue(OPPORTUNITY_FINDER_QUEUE) private readonly opportunityFinderQueue: Queue,
  ) {}

  @Get()
  @Public()
  @UseGuards(OpsMetricsGuard)
  async getMetrics() {
    const queues = await this.collectQueueDepths();
    const redis = await this.probeRedis();

    return {
      timestamp: new Date().toISOString(),
      process: this.metrics.getProcessSnapshot(),
      http: this.metrics.getHttpSnapshot(),
      jobs: this.metrics.getJobSnapshot(),
      reliability: this.metrics.getReliabilitySnapshot(),
      queues,
      redis,
    };
  }

  private queueByName(name: (typeof OPS_QUEUES)[number]): Queue {
    switch (name) {
      case PROSPECTING_QUEUE:
        return this.prospectingQueue;
      case IMPORTS_QUEUE:
        return this.importsQueue;
      case SCORING_QUEUE:
        return this.scoringQueue;
      case WEBSITE_ANALYSIS_QUEUE:
        return this.websiteAnalysisQueue;
      case OPPORTUNITY_FINDER_QUEUE:
        return this.opportunityFinderQueue;
    }
  }

  private async collectQueueDepths() {
    const result: Record<
      string,
      {
        waiting: number;
        active: number;
        delayed: number;
        failed: number;
        completed: number;
        paused: number;
      }
    > = {};

    for (const name of OPS_QUEUES) {
      const counts = await this.queueByName(name).getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
        'completed',
        'paused',
      );
      result[name] = {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
        completed: counts.completed ?? 0,
        paused: counts.paused ?? 0,
      };
    }

    return result;
  }

  private async probeRedis(): Promise<{ status: 'up' | 'down' }> {
    try {
      const redis = (await this.prospectingQueue.client) as unknown as {
        ping(): Promise<string>;
      };
      const pong = await redis.ping();
      return { status: pong === 'PONG' ? 'up' : 'down' };
    } catch {
      return { status: 'down' };
    }
  }
}

import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { IMPORTS_QUEUE } from '../imports/imports.constants';
import { PROSPECTING_QUEUE } from '../prospecting/prospecting.constants';
import { SCORING_QUEUE } from '../scoring/scoring.constants';
import { WEBSITE_ANALYSIS_QUEUE } from '../website-analysis/website-analysis.constants';
import { OPPORTUNITY_FINDER_QUEUE } from '../opportunity-finder/opportunity-finder.constants';
import { OUTBOX_QUEUE } from '../outbox/outbox.constants';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';
import { OpsMetricsController } from './ops-metrics.controller';
import { OpsMetricsGuard } from './ops-metrics.guard';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: PROSPECTING_QUEUE },
      { name: IMPORTS_QUEUE },
      { name: SCORING_QUEUE },
      { name: WEBSITE_ANALYSIS_QUEUE },
      { name: OPPORTUNITY_FINDER_QUEUE },
      { name: OUTBOX_QUEUE },
    ),
  ],
  controllers: [OpsMetricsController],
  providers: [
    MetricsService,
    OpsMetricsGuard,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
  exports: [MetricsService],
})
export class OpsModule {}

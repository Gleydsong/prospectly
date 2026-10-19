import { Module } from '@nestjs/common';

import { SuppressionService } from './suppression.service';

/**
 * Minimal suppression module providing only SuppressionService.
 * Safe for consumption by both HTTP and Worker modules (e.g. LeadsModule, CampaignsModule)
 * without pulling in API-only schedulers, HTTP controllers, or retention queues.
 */
@Module({
  providers: [SuppressionService],
  exports: [SuppressionService],
})
export class SuppressionModule {}

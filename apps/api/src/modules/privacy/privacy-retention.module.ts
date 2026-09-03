import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { PRIVACY_RETENTION_QUEUE } from './retention.constants';
import { RetentionService } from './retention.service';

@Module({
  imports: [BullModule.registerQueue({ name: PRIVACY_RETENTION_QUEUE })],
  providers: [RetentionService],
  exports: [RetentionService, BullModule],
})
export class PrivacyRetentionModule {}

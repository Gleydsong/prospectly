import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { AccountErasureService } from './account-erasure.service';
import { AccountExportService } from './account-export.service';
import { ConsentService } from './consent.service';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { PRIVACY_RETENTION_QUEUE } from './retention.constants';
import { RetentionProcessor } from './retention.processor';
import { RetentionScheduler } from './retention.scheduler';
import { RetentionService } from './retention.service';
import { SuppressionService } from './suppression.service';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: PRIVACY_RETENTION_QUEUE })],
  controllers: [PrivacyController],
  providers: [
    PrivacyService,
    ConsentService,
    SuppressionService,
    AccountExportService,
    AccountErasureService,
    RetentionService,
    RetentionProcessor,
    RetentionScheduler,
  ],
  exports: [
    ConsentService,
    SuppressionService,
    AccountExportService,
    AccountErasureService,
  ],
})
export class PrivacyModule {}

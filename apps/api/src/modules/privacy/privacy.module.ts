import { Global, Module } from '@nestjs/common';

import { AccountErasureService } from './account-erasure.service';
import { AccountExportService } from './account-export.service';
import { ConsentService } from './consent.service';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { PrivacyRetentionModule } from './privacy-retention.module';
import { RetentionScheduler } from './retention.scheduler';
import { SuppressionService } from './suppression.service';

@Global()
@Module({
  imports: [PrivacyRetentionModule],
  controllers: [PrivacyController],
  providers: [
    PrivacyService,
    ConsentService,
    SuppressionService,
    AccountExportService,
    AccountErasureService,
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

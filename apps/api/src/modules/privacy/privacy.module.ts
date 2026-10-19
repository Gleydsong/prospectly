import { Global, Module } from '@nestjs/common';

import { AccountErasureService } from './account-erasure.service';
import { AccountExportService } from './account-export.service';
import { ConsentService } from './consent.service';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { PrivacyRetentionModule } from './privacy-retention.module';
import { RetentionScheduler } from './retention.scheduler';
import { SuppressionModule } from './suppression.module';

@Global()
@Module({
  imports: [PrivacyRetentionModule, SuppressionModule],
  controllers: [PrivacyController],
  providers: [
    PrivacyService,
    ConsentService,
    AccountExportService,
    AccountErasureService,
    RetentionScheduler,
  ],
  exports: [ConsentService, SuppressionModule, AccountExportService, AccountErasureService],
})
export class PrivacyModule {}

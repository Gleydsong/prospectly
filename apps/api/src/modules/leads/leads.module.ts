import { Module, forwardRef } from '@nestjs/common';

import { BillingCoreModule } from '../billing/billing-core.module';
import { OutboxModule } from '../outbox/outbox.module';
import { WebsiteAnalysisModule } from '../website-analysis/website-analysis.module';
import { LeadsController } from './leads.controller';
import { LeadIngestionService } from './lead-ingestion.service';
import { LeadsService } from './leads.service';

@Module({
  imports: [forwardRef(() => WebsiteAnalysisModule), BillingCoreModule, OutboxModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadIngestionService],
  exports: [LeadsService, LeadIngestionService],
})
export class LeadsModule {}

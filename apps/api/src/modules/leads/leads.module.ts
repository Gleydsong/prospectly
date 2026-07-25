import { Module, forwardRef } from '@nestjs/common';

import { WebsiteAnalysisModule } from '../website-analysis/website-analysis.module';
import { LeadsController } from './leads.controller';
import { LeadIngestionService } from './lead-ingestion.service';
import { LeadsService } from './leads.service';

@Module({
  imports: [forwardRef(() => WebsiteAnalysisModule)],
  controllers: [LeadsController],
  providers: [LeadsService, LeadIngestionService],
  exports: [LeadsService, LeadIngestionService],
})
export class LeadsModule {}

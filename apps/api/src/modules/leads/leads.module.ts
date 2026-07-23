import { Module } from '@nestjs/common';

import { LeadsController } from './leads.controller';
import { LeadIngestionService } from './lead-ingestion.service';
import { LeadsService } from './leads.service';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, LeadIngestionService],
  exports: [LeadsService, LeadIngestionService],
})
export class LeadsModule {}

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { BillingCoreModule } from '../billing/billing-core.module';
import { LeadsModule } from '../leads/leads.module';
import { ProspectingModule } from '../prospecting/prospecting.module';
import { WebsiteAnalysisModule } from '../website-analysis/website-analysis.module';
import { ProspectingRegionForCountry } from './dto/prospecting-region.validator';
import { OPPORTUNITY_FINDER_QUEUE } from './opportunity-finder.constants';
import { OpportunityFinderController } from './opportunity-finder.controller';
import { OpportunityFinderService } from './opportunity-finder.service';

@Module({
  imports: [BullModule.registerQueue({ name: OPPORTUNITY_FINDER_QUEUE }), AiModule, BillingCoreModule, LeadsModule, ProspectingModule, WebsiteAnalysisModule],
  controllers: [OpportunityFinderController],
  providers: [
    OpportunityFinderService,
    ProspectingRegionForCountry,
  ],
  exports: [OpportunityFinderService],
})
export class OpportunityFinderModule {}

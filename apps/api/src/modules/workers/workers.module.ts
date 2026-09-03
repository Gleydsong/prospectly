import { Module } from '@nestjs/common';

import { ImportsModule } from '../imports/imports.module';
import { ImportsProcessor } from '../imports/imports.processor';
import { OpsModule } from '../ops/ops.module';
import { PrivacyRetentionModule } from '../privacy/privacy-retention.module';
import { RetentionProcessor } from '../privacy/retention.processor';
import { ProspectingModule } from '../prospecting/prospecting.module';
import { ProspectingProcessor } from '../prospecting/prospecting.processor';
import { ScoringModule } from '../scoring/scoring.module';
import { ScoringProcessor } from '../scoring/scoring.processor';
import { WebsiteAnalysisModule } from '../website-analysis/website-analysis.module';
import { WebsiteAnalysisProcessor } from '../website-analysis/website-analysis.processor';
import { OpportunityFinderModule } from '../opportunity-finder/opportunity-finder.module';
import { OpportunityFinderProcessor } from '../opportunity-finder/opportunity-finder.processor';

/**
 * Registers BullMQ processors for the dedicated worker process.
 * AppModule must not import this module.
 */
@Module({
  imports: [
    ProspectingModule,
    ImportsModule,
    ScoringModule,
    WebsiteAnalysisModule,
    OpsModule,
    OpportunityFinderModule,
    PrivacyRetentionModule,
  ],
  providers: [
    ProspectingProcessor,
    ImportsProcessor,
    ScoringProcessor,
    WebsiteAnalysisProcessor,
    OpportunityFinderProcessor,
    RetentionProcessor,
  ],
})
export class WorkersModule {}

import { Module } from '@nestjs/common';

import { ConversionStudioModule } from '../conversion-studio/conversion-studio.module';
import { LandingGenerationProcessor } from '../conversion-studio/generation/landing-generation.processor';
import { ImportsModule } from '../imports/imports.module';
import { ImportsProcessor } from '../imports/imports.processor';
import { OpsModule } from '../ops/ops.module';
import { ProspectingModule } from '../prospecting/prospecting.module';
import { ProspectingProcessor } from '../prospecting/prospecting.processor';
import { ScoringModule } from '../scoring/scoring.module';
import { ScoringProcessor } from '../scoring/scoring.processor';
import { WebsiteAnalysisModule } from '../website-analysis/website-analysis.module';
import { WebsiteAnalysisProcessor } from '../website-analysis/website-analysis.processor';

/**
 * Registers BullMQ processors. Imported only by WorkerModule — AppModule
 * keeps feature modules as queue producers without workers.
 */
@Module({
  imports: [
    ProspectingModule,
    ImportsModule,
    ScoringModule,
    WebsiteAnalysisModule,
    ConversionStudioModule,
    OpsModule,
  ],
  providers: [
    ProspectingProcessor,
    ImportsProcessor,
    ScoringProcessor,
    WebsiteAnalysisProcessor,
    LandingGenerationProcessor,
  ],
})
export class WorkersModule {}

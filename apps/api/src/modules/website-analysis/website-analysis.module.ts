import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ScoringModule } from '../scoring/scoring.module';
import { HttpWebsiteAnalyzer } from './http-website-analyzer';
import {
  WEBSITE_ANALYSIS_QUEUE,
  WEBSITE_ANALYSIS_TIMEOUT_MS,
} from './website-analysis.constants';
import { WebsiteAnalysisProcessor } from './website-analysis.processor';
import { WebsiteAnalysisService } from './website-analysis.service';
import { WEBSITE_ANALYZER } from './website-analysis.tokens';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBSITE_ANALYSIS_QUEUE }),
    forwardRef(() => ScoringModule),
  ],
  providers: [
    WebsiteAnalysisService,
    WebsiteAnalysisProcessor,
    {
      provide: WEBSITE_ANALYZER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new HttpWebsiteAnalyzer({
          timeoutMs:
            config.get<number>('websiteAnalysis.timeoutMs') ?? WEBSITE_ANALYSIS_TIMEOUT_MS,
          maxBodyBytes: config.get<number>('websiteAnalysis.maxBodyBytes'),
          maxRedirects: config.get<number>('websiteAnalysis.maxRedirects'),
        }),
    },
  ],
  exports: [WebsiteAnalysisService],
})
export class WebsiteAnalysisModule {}

import { MODULE_METADATA } from '@nestjs/common/constants';

import { ImportsProcessor } from '../imports/imports.processor';
import { OpportunityFinderProcessor } from '../opportunity-finder/opportunity-finder.processor';
import { PrivacyRetentionModule } from '../privacy/privacy-retention.module';
import { RetentionProcessor } from '../privacy/retention.processor';
import { RetentionScheduler } from '../privacy/retention.scheduler';
import { ProspectingProcessor } from '../prospecting/prospecting.processor';
import { ScoringProcessor } from '../scoring/scoring.processor';
import { WebsiteAnalysisProcessor } from '../website-analysis/website-analysis.processor';
import { WorkersModule } from './workers.module';

function providerTokens(mod: object): unknown[] {
  const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, mod) as unknown[]) ?? [];
  return providers.map((provider) =>
    provider && typeof provider === 'object' && 'provide' in provider
      ? (provider as { provide: unknown }).provide
      : provider,
  );
}

describe('WorkersModule', () => {
  it('registers every BullMQ processor and no API-only retention scheduler', () => {
    const tokens = providerTokens(WorkersModule);
    expect(tokens).toEqual(
      expect.arrayContaining([
        ProspectingProcessor,
        ImportsProcessor,
        ScoringProcessor,
        WebsiteAnalysisProcessor,
        OpportunityFinderProcessor,
        RetentionProcessor,
      ]),
    );
    expect(tokens).toHaveLength(6);
    expect(tokens).not.toContain(RetentionScheduler);

    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, WorkersModule) as unknown[];
    expect(imports).toContain(PrivacyRetentionModule);
  });
});

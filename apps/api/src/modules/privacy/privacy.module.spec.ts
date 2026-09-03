import { MODULE_METADATA } from '@nestjs/common/constants';

import { PrivacyModule } from './privacy.module';
import { PrivacyRetentionModule } from './privacy-retention.module';
import { RetentionProcessor } from './retention.processor';
import { RetentionScheduler } from './retention.scheduler';
import { RetentionService } from './retention.service';

function providerTokens(mod: object): unknown[] {
  const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, mod) as unknown[]) ?? [];
  return providers.map((provider) =>
    provider && typeof provider === 'object' && 'provide' in provider
      ? (provider as { provide: unknown }).provide
      : provider,
  );
}

describe('PrivacyModule', () => {
  it('keeps the retention scheduler on the API and leaves the processor out', () => {
    const tokens = providerTokens(PrivacyModule);
    expect(tokens).toContain(RetentionScheduler);
    expect(tokens).not.toContain(RetentionProcessor);

    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, PrivacyModule) as unknown[];
    expect(imports).toContain(PrivacyRetentionModule);
  });
});

describe('PrivacyRetentionModule', () => {
  it('exports RetentionService for both producer and consumer graphs', () => {
    expect(providerTokens(PrivacyRetentionModule)).toContain(RetentionService);
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, PrivacyRetentionModule) as unknown[];
    expect(exports).toContain(RetentionService);
  });
});

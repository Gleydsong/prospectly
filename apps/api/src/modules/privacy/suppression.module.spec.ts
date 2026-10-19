import { MODULE_METADATA } from '@nestjs/common/constants';

import { SuppressionModule } from './suppression.module';
import { SuppressionService } from './suppression.service';
import { RetentionScheduler } from './retention.scheduler';
import { PrivacyRetentionModule } from './privacy-retention.module';

function providerTokens(mod: object): unknown[] {
  const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, mod) as unknown[]) ?? [];
  return providers.map((provider) =>
    provider && typeof provider === 'object' && 'provide' in provider
      ? (provider as { provide: unknown }).provide
      : provider,
  );
}

describe('SuppressionModule', () => {
  it('provides and exports SuppressionService without schedulers or retention modules', () => {
    const tokens = providerTokens(SuppressionModule);
    expect(tokens).toContain(SuppressionService);
    expect(tokens).not.toContain(RetentionScheduler);

    const exports =
      (Reflect.getMetadata(MODULE_METADATA.EXPORTS, SuppressionModule) as unknown[]) ?? [];
    expect(exports).toContain(SuppressionService);

    const imports =
      (Reflect.getMetadata(MODULE_METADATA.IMPORTS, SuppressionModule) as unknown[]) ?? [];
    expect(imports).not.toContain(PrivacyRetentionModule);
  });
});

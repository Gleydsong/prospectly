import { MODULE_METADATA } from '@nestjs/common/constants';

import { AsaasWebhookService } from './asaas-webhook.service';
import { BillingController } from './billing.controller';
import { BillingCoreModule } from './billing-core.module';
import { BillingModule } from './billing.module';
import { BillingService } from './billing.service';
import { EntitlementService } from './entitlement.service';

function providerTokens(mod: object): unknown[] {
  const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, mod) as unknown[]) ?? [];
  return providers.map((provider) =>
    provider && typeof provider === 'object' && 'provide' in provider
      ? (provider as { provide: unknown }).provide
      : provider,
  );
}

describe('Billing composition', () => {
  it('keeps webhook polling and HTTP on BillingModule only', () => {
    expect(providerTokens(BillingModule)).toContain(AsaasWebhookService);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, BillingModule)).toContain(
      BillingController,
    );
    expect(providerTokens(BillingCoreModule)).not.toContain(AsaasWebhookService);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, BillingCoreModule) ?? []).not.toContain(
      BillingController,
    );
  });

  it('exports domain billing services from the shared core', () => {
    const exported = Reflect.getMetadata(MODULE_METADATA.EXPORTS, BillingCoreModule) as unknown[];
    expect(exported).toEqual(expect.arrayContaining([BillingService, EntitlementService]));
  });
});

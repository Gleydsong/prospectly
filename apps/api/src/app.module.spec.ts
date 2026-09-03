jest.mock('./config/validation', () => ({
  validateEnv: (config: Record<string, unknown>) => config,
}));

import { MODULE_METADATA } from '@nestjs/common/constants';

import { HealthModule } from './common/health/health.module';
import { AppModule } from './app.module';
import { ApiDispatchModule } from './modules/api-runtime/api-dispatch.module';
import { BillingModule } from './modules/billing/billing.module';
import { ImportsModule } from './modules/imports/imports.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { ProspectingModule } from './modules/prospecting/prospecting.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { WorkersModule } from './modules/workers/workers.module';

describe('AppModule', () => {
  const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as unknown[];

  it('does not instantiate BullMQ processors in the HTTP process', () => {
    expect(imports).not.toContain(WorkersModule);
  });

  it('keeps API-only dispatch reconcilers, privacy scheduler and billing webhook', () => {
    expect(imports).toContain(ApiDispatchModule);
    expect(imports).toContain(PrivacyModule);
    expect(imports).toContain(BillingModule);
  });

  it('still registers queue producer modules and HTTP health', () => {
    expect(imports).toContain(ProspectingModule);
    expect(imports).toContain(ImportsModule);
    expect(imports).toContain(ScoringModule);
    expect(imports).toContain(HealthModule);
  });
});

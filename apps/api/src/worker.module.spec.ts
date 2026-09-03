jest.mock('./config/validation', () => ({
  validateEnv: (config: Record<string, unknown>) => config,
}));

import { MODULE_METADATA } from '@nestjs/common/constants';

import { WorkerModule } from './worker.module';
import { ApiDispatchModule } from './modules/api-runtime/api-dispatch.module';
import { BillingModule } from './modules/billing/billing.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { WorkersModule } from './modules/workers/workers.module';

describe('WorkerModule', () => {
  const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, WorkerModule) as unknown[];

  it('registers BullMQ processors and omits API-only schedulers and reconcilers', () => {
    expect(imports).toContain(WorkersModule);
    expect(imports).not.toContain(PrivacyModule);
    expect(imports).not.toContain(ApiDispatchModule);
    expect(imports).not.toContain(BillingModule);
  });
});

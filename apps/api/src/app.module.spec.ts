jest.mock('./config/validation', () => ({
  validateEnv: (config: Record<string, unknown>) => config,
}));

import { MODULE_METADATA } from '@nestjs/common/constants';

import { AppModule } from './app.module';
import { WorkersModule } from './modules/workers/workers.module';

describe('AppModule', () => {
  it('registers BullMQ processors so the HTTP API can drain searches without a separate worker', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as unknown[];
    expect(imports).toContain(WorkersModule);
  });
});

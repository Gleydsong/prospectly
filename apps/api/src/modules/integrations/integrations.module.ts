import { Module } from '@nestjs/common';

import { IntegrationsController } from './integrations.controller';
import { PluginAccessService } from './plugin-access.service';

@Module({
  controllers: [IntegrationsController],
  providers: [PluginAccessService],
  exports: [PluginAccessService],
})
export class IntegrationsModule {}

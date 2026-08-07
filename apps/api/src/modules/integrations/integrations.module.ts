import { Module } from '@nestjs/common';

import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { PluginAccessService } from './plugin-access.service';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, PluginAccessService],
  exports: [IntegrationsService, PluginAccessService],
})
export class IntegrationsModule {}

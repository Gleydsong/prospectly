import { Module } from '@nestjs/common';

import { OauthModule } from '../oauth/oauth.module';
import { IntegrationsController } from './integrations.controller';
import { PluginAccessService } from './plugin-access.service';

@Module({
  imports: [OauthModule],
  controllers: [IntegrationsController],
  providers: [PluginAccessService],
  exports: [PluginAccessService],
})
export class IntegrationsModule {}

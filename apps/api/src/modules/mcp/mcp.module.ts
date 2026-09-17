import { Module } from '@nestjs/common';

import { IntegrationsModule } from '../integrations/integrations.module';
import { OauthModule } from '../oauth/oauth.module';
import { McpController } from './mcp.controller';

@Module({
  imports: [OauthModule, IntegrationsModule],
  controllers: [McpController],
})
export class McpModule {}

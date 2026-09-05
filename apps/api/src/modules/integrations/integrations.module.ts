import { Module } from '@nestjs/common';

import { OpsModule } from '../ops/ops.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { PluginAccessService } from './plugin-access.service';
import { WebhookDeliveryService } from './webhook-delivery.service';

@Module({
  imports: [OpsModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, PluginAccessService, WebhookDeliveryService],
  exports: [IntegrationsService, PluginAccessService, WebhookDeliveryService],
})
export class IntegrationsModule {}

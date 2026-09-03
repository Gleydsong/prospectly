import { Module } from '@nestjs/common';

import { AsaasWebhookService } from './asaas-webhook.service';
import { BillingController } from './billing.controller';
import { BillingCoreModule } from './billing-core.module';

@Module({
  imports: [BillingCoreModule],
  controllers: [BillingController],
  providers: [AsaasWebhookService],
  exports: [BillingCoreModule],
})
export class BillingModule {}

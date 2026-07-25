import { Module } from '@nestjs/common';

import { BillingActivationService } from './billing-activation.service';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AbacateClient } from './infrastructure/abacate.client';
import { AbacatePaymentProvider } from './infrastructure/abacate.payment-provider';
import { StripePaymentProvider } from './infrastructure/stripe.payment-provider';

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingActivationService,
    StripePaymentProvider,
    AbacateClient,
    AbacatePaymentProvider,
  ],
  exports: [BillingService],
})
export class BillingModule {}

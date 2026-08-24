import { Module } from '@nestjs/common';

import { BillingActivationService } from './billing-activation.service';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { CreditPurchaseService } from './credit-purchase.service';
import { EntitlementService } from './entitlement.service';
import { MonthlyCheckoutAttemptService } from './monthly-checkout-attempt.service';
import { AbacateClient } from './infrastructure/abacate.client';
import { AbacatePaymentProvider } from './infrastructure/abacate.payment-provider';

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    CreditPurchaseService,
    BillingActivationService,
    EntitlementService,
    MonthlyCheckoutAttemptService,
    AbacateClient,
    AbacatePaymentProvider,
  ],
  exports: [BillingService, EntitlementService],
})
export class BillingModule {}

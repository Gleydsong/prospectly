import { Module } from '@nestjs/common';

import { BillingActivationService } from './billing-activation.service';
import { BillingController } from './billing.controller';
import { BillingProfileService } from './billing-profile.service';
import { AsaasWebhookService } from './asaas-webhook.service';
import { BillingService } from './billing.service';
import { CreditPurchaseService } from './credit-purchase.service';
import { EntitlementService } from './entitlement.service';
import { MonthlyCheckoutAttemptService } from './monthly-checkout-attempt.service';
import { AbacateClient } from './infrastructure/abacate.client';
import { AbacatePaymentProvider } from './infrastructure/abacate.payment-provider';
import { AsaasClient } from './infrastructure/asaas.client';

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingProfileService,
    AsaasWebhookService,
    CreditPurchaseService,
    BillingActivationService,
    EntitlementService,
    MonthlyCheckoutAttemptService,
    AbacateClient,
    AbacatePaymentProvider,
    AsaasClient,
  ],
  exports: [BillingService, EntitlementService],
})
export class BillingModule {}

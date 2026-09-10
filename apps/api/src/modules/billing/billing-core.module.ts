import { Module } from '@nestjs/common';

import { MailModule } from '../../common/mail/mail.module';
import { BillingActivationService } from './billing-activation.service';
import { BillingProfileService } from './billing-profile.service';
import { BillingService } from './billing.service';
import { CreditPurchaseService } from './credit-purchase.service';
import { EntitlementService } from './entitlement.service';
import { AsaasCheckoutSwitchService } from './asaas-checkout-switch.service';
import { MonthlyCheckoutAttemptService } from './monthly-checkout-attempt.service';
import { AsaasClient } from './infrastructure/asaas.client';

const BILLING_CORE_PROVIDERS = [
  BillingService,
  BillingProfileService,
  CreditPurchaseService,
  BillingActivationService,
  EntitlementService,
  MonthlyCheckoutAttemptService,
  AsaasCheckoutSwitchService,
  AsaasClient,
];

@Module({
  imports: [MailModule],
  providers: BILLING_CORE_PROVIDERS,
  exports: BILLING_CORE_PROVIDERS,
})
export class BillingCoreModule {}

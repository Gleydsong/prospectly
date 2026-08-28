ALTER TYPE "BillingWebhookEventStatus" ADD VALUE IF NOT EXISTS 'REVIEW_REQUIRED';

ALTER TABLE "MonthlyCheckoutAttempt" ADD COLUMN "lastReconciledAt" TIMESTAMP(3);
ALTER TABLE "CreditPurchase" ADD COLUMN "lastReconciledAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "MonthlyCheckoutAttempt_organizationId_provider_paymentMethod_key";
CREATE INDEX "MonthlyCheckoutAttempt_organizationId_provider_paymentMethod_idx"
  ON "MonthlyCheckoutAttempt" ("organizationId", provider, "paymentMethod");

CREATE UNIQUE INDEX "MonthlyCheckoutAttempt_asaas_active_organization_key"
  ON "MonthlyCheckoutAttempt" ("organizationId")
  WHERE provider = 'ASAAS'::"PaymentProvider"
    AND status IN (
      'PROCESSING'::"BillingCheckoutAttemptStatus",
      'READY'::"BillingCheckoutAttemptStatus",
      'REVIEW_REQUIRED'::"BillingCheckoutAttemptStatus"
    );

CREATE INDEX "MonthlyCheckoutAttempt_provider_status_lastReconciledAt_idx"
  ON "MonthlyCheckoutAttempt" (provider, status, "lastReconciledAt");
CREATE INDEX "CreditPurchase_provider_status_lastReconciledAt_idx"
  ON "CreditPurchase" (provider, status, "lastReconciledAt");

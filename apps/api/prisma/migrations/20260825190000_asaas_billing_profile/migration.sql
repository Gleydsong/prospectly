-- Add the Asaas provider without changing historical Stripe or AbacatePay rows.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'ASAAS';
ALTER TYPE "CreditPurchaseStatus" ADD VALUE IF NOT EXISTS 'REVIEW_REQUIRED';
ALTER TYPE "BillingCheckoutAttemptStatus" ADD VALUE IF NOT EXISTS 'REVIEW_REQUIRED';
ALTER TYPE "CreditLedgerReason" ADD VALUE IF NOT EXISTS 'PURCHASE_REVERSAL';
ALTER TYPE "BillingWebhookEventStatus" ADD VALUE IF NOT EXISTS 'PENDING';

ALTER TABLE "Organization" ADD COLUMN "asaasSubscriptionId" TEXT;
CREATE UNIQUE INDEX "Organization_asaasSubscriptionId_key" ON "Organization"("asaasSubscriptionId");
CREATE INDEX "Organization_asaasSubscriptionId_idx" ON "Organization"("asaasSubscriptionId");

ALTER TABLE "BillingWebhookEvent" ADD COLUMN "payload" JSONB;

-- Store only the minimum payer profile. Card data is intentionally absent.
CREATE TABLE "BillingProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cpfCnpj" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "asaasCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingProfile_organizationId_key" ON "BillingProfile"("organizationId");
CREATE UNIQUE INDEX "BillingProfile_asaasCustomerId_key" ON "BillingProfile"("asaasCustomerId");
CREATE INDEX "BillingProfile_asaasCustomerId_idx" ON "BillingProfile"("asaasCustomerId");

ALTER TABLE "BillingProfile" ADD CONSTRAINT "BillingProfile_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "BillingProfile" TO prospectly_app;
ALTER TABLE "BillingProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingProfile" FORCE ROW LEVEL SECURITY;
CREATE POLICY "BillingProfile_tenant_isolation" ON "BillingProfile"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

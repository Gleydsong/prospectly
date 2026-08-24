-- Appmax is the card gateway; Stripe identifiers remain temporarily for historical traceability.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'APPMAX';

CREATE TYPE "AppmaxCheckoutKind" AS ENUM ('MONTHLY', 'CREDITS');
CREATE TYPE "AppmaxCheckoutStatus" AS ENUM (
  'PROCESSING',
  'PAYMENT_PENDING',
  'RECONCILING',
  'COMPLETED',
  'FAILED',
  'REVIEW_REQUIRED'
);

ALTER TABLE "Organization"
  ADD COLUMN "appmaxCustomerId" TEXT,
  ADD COLUMN "appmaxSubscriptionId" TEXT,
  ADD COLUMN "appmaxLastReconciledAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Organization_appmaxCustomerId_key" ON "Organization"("appmaxCustomerId");
CREATE UNIQUE INDEX "Organization_appmaxSubscriptionId_key" ON "Organization"("appmaxSubscriptionId");
CREATE INDEX "Organization_appmaxCustomerId_idx" ON "Organization"("appmaxCustomerId");

CREATE TABLE "AppmaxCheckoutAttempt" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "purchaseId" TEXT,
  "checkoutKey" TEXT NOT NULL,
  "kind" "AppmaxCheckoutKind" NOT NULL,
  "offer" TEXT,
  "amountCentavos" INTEGER NOT NULL,
  "status" "AppmaxCheckoutStatus" NOT NULL DEFAULT 'PROCESSING',
  "customerEmail" TEXT NOT NULL,
  "externalCustomerId" TEXT,
  "externalOrderId" TEXT,
  "externalSubscriptionId" TEXT,
  "providerStatus" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextReconcileAt" TIMESTAMP(3),
  "lastReconciledAt" TIMESTAMP(3),
  "lastError" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppmaxCheckoutAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppmaxCheckoutAttempt_purchaseId_key" ON "AppmaxCheckoutAttempt"("purchaseId");
CREATE UNIQUE INDEX "AppmaxCheckoutAttempt_checkoutKey_key" ON "AppmaxCheckoutAttempt"("checkoutKey");
CREATE UNIQUE INDEX "AppmaxCheckoutAttempt_externalOrderId_key" ON "AppmaxCheckoutAttempt"("externalOrderId");
CREATE UNIQUE INDEX "AppmaxCheckoutAttempt_externalSubscriptionId_key" ON "AppmaxCheckoutAttempt"("externalSubscriptionId");
CREATE INDEX "AppmaxCheckoutAttempt_organizationId_createdAt_idx" ON "AppmaxCheckoutAttempt"("organizationId", "createdAt");
CREATE INDEX "AppmaxCheckoutAttempt_status_nextReconcileAt_idx" ON "AppmaxCheckoutAttempt"("status", "nextReconcileAt");

ALTER TABLE "AppmaxCheckoutAttempt" ADD CONSTRAINT "AppmaxCheckoutAttempt_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppmaxCheckoutAttempt" ADD CONSTRAINT "AppmaxCheckoutAttempt_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "CreditPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

GRANT USAGE ON TYPE "AppmaxCheckoutKind", "AppmaxCheckoutStatus" TO prospectly_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "AppmaxCheckoutAttempt" TO prospectly_app;
ALTER TABLE "AppmaxCheckoutAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppmaxCheckoutAttempt" FORCE ROW LEVEL SECURITY;
CREATE POLICY "AppmaxCheckoutAttempt_tenant_isolation" ON "AppmaxCheckoutAttempt"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

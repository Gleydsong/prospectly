-- CreateEnum
CREATE TYPE "BillingCheckoutAttemptStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "MonthlyCheckoutAttempt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'ABACATE',
    "paymentMethod" "BillingPaymentMethod" NOT NULL,
    "status" "BillingCheckoutAttemptStatus" NOT NULL DEFAULT 'PROCESSING',
    "externalId" TEXT NOT NULL,
    "externalCheckoutId" TEXT,
    "externalCustomerId" TEXT,
    "checkoutUrl" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyCheckoutAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyCheckoutAttempt_externalId_key" ON "MonthlyCheckoutAttempt"("externalId");
CREATE UNIQUE INDEX "MonthlyCheckoutAttempt_externalCheckoutId_key" ON "MonthlyCheckoutAttempt"("externalCheckoutId");
CREATE UNIQUE INDEX "MonthlyCheckoutAttempt_organizationId_provider_paymentMethod_key" ON "MonthlyCheckoutAttempt"("organizationId", "provider", "paymentMethod");
CREATE INDEX "MonthlyCheckoutAttempt_status_updatedAt_idx" ON "MonthlyCheckoutAttempt"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "MonthlyCheckoutAttempt" ADD CONSTRAINT "MonthlyCheckoutAttempt_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep the new tenant table under the same restricted runtime role and RLS boundary.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MonthlyCheckoutAttempt" TO prospectly_app;
ALTER TABLE "MonthlyCheckoutAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MonthlyCheckoutAttempt" FORCE ROW LEVEL SECURITY;
CREATE POLICY "MonthlyCheckoutAttempt_tenant_isolation" ON "MonthlyCheckoutAttempt"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

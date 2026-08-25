ALTER TABLE "CreditPurchase" ADD COLUMN "checkoutUrl" TEXT;

ALTER TABLE "MonthlyCheckoutAttempt"
  ADD COLUMN "product" TEXT NOT NULL DEFAULT 'MONTHLY_ACCESS',
  ADD COLUMN "amountCentavos" INTEGER NOT NULL DEFAULT 4999,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BRL';

-- Prevent concurrent requests from creating more than one unresolved Asaas package charge.
CREATE UNIQUE INDEX "CreditPurchase_asaas_active_organization_key"
  ON "CreditPurchase" ("organizationId")
  WHERE provider = 'ASAAS'::"PaymentProvider"
    AND status IN ('PENDING'::"CreditPurchaseStatus", 'REVIEW_REQUIRED'::"CreditPurchaseStatus");

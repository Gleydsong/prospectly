-- Crash-safe webhook idempotency + optional payment method on credit purchases.
-- Rollback: DROP INDEX "BillingWebhookEvent_status_updatedAt_idx";
--   ALTER TABLE "CreditPurchase" DROP COLUMN "paymentMethod";
--   ALTER TABLE "BillingWebhookEvent" DROP COLUMN "status", DROP COLUMN "attempts",
--     DROP COLUMN "lastError", DROP COLUMN "createdAt", DROP COLUMN "failedAt", DROP COLUMN "updatedAt";
--   ALTER TABLE "BillingWebhookEvent" ALTER COLUMN "processedAt" SET NOT NULL, ALTER COLUMN "processedAt" SET DEFAULT CURRENT_TIMESTAMP;
--   DROP TYPE "BillingWebhookEventStatus"; DROP TYPE "BillingPaymentMethod";

CREATE TYPE "BillingWebhookEventStatus" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED');
CREATE TYPE "BillingPaymentMethod" AS ENUM ('PIX', 'CARD');

ALTER TABLE "BillingWebhookEvent"
  ADD COLUMN "status" "BillingWebhookEventStatus" NOT NULL DEFAULT 'PROCESSING',
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "failedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing rows were already applied under the previous create-then-delete claim.
UPDATE "BillingWebhookEvent" SET "status" = 'PROCESSED' WHERE "processedAt" IS NOT NULL;

ALTER TABLE "BillingWebhookEvent" ALTER COLUMN "processedAt" DROP NOT NULL;
ALTER TABLE "BillingWebhookEvent" ALTER COLUMN "processedAt" DROP DEFAULT;

CREATE INDEX "BillingWebhookEvent_status_updatedAt_idx" ON "BillingWebhookEvent"("status", "updatedAt");

ALTER TABLE "CreditPurchase" ADD COLUMN "paymentMethod" "BillingPaymentMethod";

-- Historical Stripe purchases were card checkouts.
UPDATE "CreditPurchase" SET "paymentMethod" = 'CARD' WHERE "provider" = 'STRIPE' AND "paymentMethod" IS NULL;
-- Pre-migration Abacate purchases were transparent PIX. Ambiguous if any CARD Abacate
-- credits existed (they did not in this product); documented in docs/billing/dual-gateways.md.
UPDATE "CreditPurchase" SET "paymentMethod" = 'PIX' WHERE "provider" = 'ABACATE' AND "paymentMethod" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'prospectly_app') THEN
    GRANT USAGE ON TYPE "BillingWebhookEventStatus" TO prospectly_app;
    GRANT USAGE ON TYPE "BillingPaymentMethod" TO prospectly_app;
  END IF;
END
$$;

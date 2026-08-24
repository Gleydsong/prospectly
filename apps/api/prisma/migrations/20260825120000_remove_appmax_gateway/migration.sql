-- Appmax was never enabled and has no production records. Abort instead of
-- discarding financial data if that assumption is no longer true at deploy time.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Organization" WHERE "paymentProvider"::text = 'APPMAX')
    OR EXISTS (SELECT 1 FROM "CreditPurchase" WHERE "provider"::text = 'APPMAX')
    OR EXISTS (SELECT 1 FROM "BillingWebhookEvent" WHERE "provider"::text = 'APPMAX')
    OR EXISTS (SELECT 1 FROM "MonthlyCheckoutAttempt" WHERE "provider"::text = 'APPMAX')
    OR EXISTS (SELECT 1 FROM "AppmaxCheckoutAttempt")
    OR EXISTS (SELECT 1 FROM "AppmaxInstallation")
  THEN
    RAISE EXCEPTION 'Cannot remove Appmax gateway while Appmax billing data exists';
  END IF;
END $$;

DROP TABLE "AppmaxCheckoutAttempt";
DROP TABLE "AppmaxInstallation";

ALTER TABLE "Organization"
  DROP COLUMN "appmaxCustomerId",
  DROP COLUMN "appmaxSubscriptionId",
  DROP COLUMN "appmaxLastReconciledAt";

CREATE TYPE "PaymentProvider_new" AS ENUM ('STRIPE', 'ABACATE');

ALTER TABLE "MonthlyCheckoutAttempt" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "Organization"
  ALTER COLUMN "paymentProvider" TYPE "PaymentProvider_new"
  USING ("paymentProvider"::text::"PaymentProvider_new");
ALTER TABLE "CreditPurchase"
  ALTER COLUMN "provider" TYPE "PaymentProvider_new"
  USING ("provider"::text::"PaymentProvider_new");
ALTER TABLE "BillingWebhookEvent"
  ALTER COLUMN "provider" TYPE "PaymentProvider_new"
  USING ("provider"::text::"PaymentProvider_new");
ALTER TABLE "MonthlyCheckoutAttempt"
  ALTER COLUMN "provider" TYPE "PaymentProvider_new"
  USING ("provider"::text::"PaymentProvider_new");

DROP TYPE "PaymentProvider";
ALTER TYPE "PaymentProvider_new" RENAME TO "PaymentProvider";
ALTER TABLE "MonthlyCheckoutAttempt"
  ALTER COLUMN "provider" SET DEFAULT 'ABACATE'::"PaymentProvider";

DROP TYPE "AppmaxCheckoutKind";
DROP TYPE "AppmaxCheckoutStatus";

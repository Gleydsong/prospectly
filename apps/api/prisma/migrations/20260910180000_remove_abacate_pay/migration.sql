-- Drop AbacatePay columns and associated constraints/indexes from Organization
ALTER TABLE "Organization"
  DROP COLUMN "abacateCustomerId",
  DROP COLUMN "abacateSubscriptionId",
  DROP COLUMN "abacatePaymentId";

-- Update default provider on MonthlyCheckoutAttempt from ABACATE to ASAAS
ALTER TABLE "MonthlyCheckoutAttempt"
  ALTER COLUMN "provider" SET DEFAULT 'ASAAS'::"PaymentProvider";

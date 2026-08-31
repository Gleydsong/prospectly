-- Asaas hosted checkout requires street, number, neighborhood and postal code on customerData.
ALTER TABLE "BillingProfile" ADD COLUMN "address" TEXT;
ALTER TABLE "BillingProfile" ADD COLUMN "addressNumber" TEXT;
ALTER TABLE "BillingProfile" ADD COLUMN "complement" TEXT;
ALTER TABLE "BillingProfile" ADD COLUMN "province" TEXT;
ALTER TABLE "BillingProfile" ADD COLUMN "postalCode" TEXT;

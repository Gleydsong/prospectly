ALTER TABLE "Organization"
ADD COLUMN "asaasPaymentId" TEXT;

CREATE UNIQUE INDEX "Organization_asaasPaymentId_key"
ON "Organization"("asaasPaymentId");

CREATE INDEX "Organization_asaasPaymentId_idx"
ON "Organization"("asaasPaymentId");

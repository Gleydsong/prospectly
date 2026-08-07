-- CreateEnum
CREATE TYPE "CreditLedgerReason" AS ENUM ('SEARCH_CONSUME', 'PURCHASE', 'REFUND', 'AI_CONSUME');

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reason" "CreditLedgerReason" NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "searchId" TEXT,
    "purchaseId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_organizationId_createdAt_idx" ON "CreditLedgerEntry"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_organizationId_reason_createdAt_idx" ON "CreditLedgerEntry"("organizationId", "reason", "createdAt");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_searchId_idx" ON "CreditLedgerEntry"("searchId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_purchaseId_idx" ON "CreditLedgerEntry"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedgerEntry_organizationId_idempotencyKey_key" ON "CreditLedgerEntry"("organizationId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "Search"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CreditPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

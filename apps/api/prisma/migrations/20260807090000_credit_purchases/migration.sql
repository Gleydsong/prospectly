-- CreateEnum
CREATE TYPE "CreditPurchaseStatus" AS ENUM ('PENDING', 'COMPLETED', 'REFUNDED', 'FAILED');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "creditBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CreditPurchase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "offer" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "amountCentavos" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "provider" "PaymentProvider" NOT NULL,
    "status" "CreditPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT NOT NULL,
    "externalPaymentId" TEXT,
    "completedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditPurchase_externalId_key" ON "CreditPurchase"("externalId");
CREATE UNIQUE INDEX "CreditPurchase_externalPaymentId_key" ON "CreditPurchase"("externalPaymentId");
CREATE INDEX "CreditPurchase_organizationId_createdAt_idx" ON "CreditPurchase"("organizationId", "createdAt");
CREATE INDEX "CreditPurchase_organizationId_status_idx" ON "CreditPurchase"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "CreditPurchase" ADD CONSTRAINT "CreditPurchase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

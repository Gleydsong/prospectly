-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'ABACATE');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "paymentProvider" "PaymentProvider",
ADD COLUMN "abacateCustomerId" TEXT,
ADD COLUMN "abacateSubscriptionId" TEXT,
ADD COLUMN "abacatePaymentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_abacateCustomerId_key" ON "Organization"("abacateCustomerId");
CREATE UNIQUE INDEX "Organization_abacateSubscriptionId_key" ON "Organization"("abacateSubscriptionId");
CREATE UNIQUE INDEX "Organization_abacatePaymentId_key" ON "Organization"("abacatePaymentId");
CREATE INDEX "Organization_abacateCustomerId_idx" ON "Organization"("abacateCustomerId");
CREATE INDEX "Organization_paymentProvider_idx" ON "Organization"("paymentProvider");

-- Backfill Stripe orgs
UPDATE "Organization"
SET "paymentProvider" = 'STRIPE'
WHERE "stripeCustomerId" IS NOT NULL OR "stripeSubscriptionId" IS NOT NULL;

-- CreateTable BillingWebhookEvent
CREATE TABLE "BillingWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingWebhookEvent_provider_eventId_key" ON "BillingWebhookEvent"("provider", "eventId");
CREATE INDEX "BillingWebhookEvent_processedAt_idx" ON "BillingWebhookEvent"("processedAt");

-- Migrate StripeWebhookEvent rows (reuse Stripe event id as row id)
INSERT INTO "BillingWebhookEvent" ("id", "provider", "eventId", "type", "processedAt")
SELECT "id", 'STRIPE', "id", "type", "processedAt"
FROM "StripeWebhookEvent";

DROP TABLE "StripeWebhookEvent";

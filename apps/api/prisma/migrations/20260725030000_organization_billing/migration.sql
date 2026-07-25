-- Organization billing (Stripe) + user terms consent + DSR stub
CREATE TYPE "OrgPlan" AS ENUM ('FREE', 'STARTER_MONTHLY', 'LIFETIME');
CREATE TYPE "PlanStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'PAST_DUE', 'CANCELED');

ALTER TABLE "Organization"
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "plan" "OrgPlan" NOT NULL DEFAULT 'FREE',
  ADD COLUMN "planStatus" "PlanStatus" NOT NULL DEFAULT 'INACTIVE',
  ADD COLUMN "planCurrency" TEXT,
  ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);

CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");
CREATE UNIQUE INDEX "Organization_stripeSubscriptionId_key" ON "Organization"("stripeSubscriptionId");
CREATE INDEX "Organization_planStatus_idx" ON "Organization"("planStatus");
CREATE INDEX "Organization_stripeCustomerId_idx" ON "Organization"("stripeCustomerId");

ALTER TABLE "User"
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "termsVersion" TEXT,
  ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3);

CREATE TABLE "DataSubjectRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DataSubjectRequest_userId_status_idx" ON "DataSubjectRequest"("userId", "status");

ALTER TABLE "DataSubjectRequest"
  ADD CONSTRAINT "DataSubjectRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

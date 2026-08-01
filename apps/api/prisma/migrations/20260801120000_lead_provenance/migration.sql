-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "websiteStatusReason" TEXT,
ADD COLUMN "confidenceLevel" "ConfidenceLevel",
ADD COLUMN "lastVerifiedAt" TIMESTAMP(3);

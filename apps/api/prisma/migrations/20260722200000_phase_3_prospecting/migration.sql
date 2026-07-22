-- CreateEnum
CREATE TYPE "WebsitePresence" AS ENUM ('NO_WEBSITE_REPORTED', 'WEBSITE_FOUND', 'NEEDS_REVIEW');

-- AlterEnum
ALTER TYPE "SearchStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "Lead"
  ADD COLUMN "websitePresence" "WebsitePresence" NOT NULL DEFAULT 'NEEDS_REVIEW',
  ADD COLUMN "websiteCheckedAt" TIMESTAMP(3),
  ADD COLUMN "websiteCheckSource" TEXT;

-- AlterTable
ALTER TABLE "SearchResult"
  ADD COLUMN "websitePresence" "WebsitePresence" NOT NULL DEFAULT 'NEEDS_REVIEW',
  ADD COLUMN "normalizedData" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "SearchResult" ALTER COLUMN "normalizedData" DROP DEFAULT;

-- DropIndex
DROP INDEX "Lead_organizationId_source_externalId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Lead_organizationId_source_externalId_key" ON "Lead"("organizationId", "source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchResult_searchId_externalId_key" ON "SearchResult"("searchId", "externalId");

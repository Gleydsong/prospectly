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

ALTER TABLE "SearchResult" ALTER COLUMN "websitePresence" DROP DEFAULT;

-- Detect legacy identities before introducing the uniqueness guarantees. The migration
-- is deliberately non-destructive: it fails with the first deterministic conflict so
-- operators can resolve or restore the affected leads before rerunning the deploy.
DO $$
DECLARE
  conflict_record RECORD;
BEGIN
  SELECT conflict_type, organization_id, identity_value, lead_ids
  INTO conflict_record
  FROM (
    SELECT
      'domain' AS conflict_type,
      "organizationId" AS organization_id,
      "domain" AS identity_value,
      array_agg("id" ORDER BY "createdAt", "id") AS lead_ids
    FROM "Lead"
    WHERE "domain" IS NOT NULL
    GROUP BY "organizationId", "domain"
    HAVING count(*) > 1

    UNION ALL

    SELECT
      'email' AS conflict_type,
      "organizationId" AS organization_id,
      "email" AS identity_value,
      array_agg("id" ORDER BY "createdAt", "id") AS lead_ids
    FROM "Lead"
    WHERE "email" IS NOT NULL
    GROUP BY "organizationId", "email"
    HAVING count(*) > 1

    UNION ALL

    SELECT
      'external_identity' AS conflict_type,
      "organizationId" AS organization_id,
      "source"::text || ':' || "externalId" AS identity_value,
      array_agg("id" ORDER BY "createdAt", "id") AS lead_ids
    FROM "Lead"
    WHERE "externalId" IS NOT NULL
    GROUP BY "organizationId", "source", "externalId"
    HAVING count(*) > 1

    UNION ALL

    SELECT
      'phone' AS conflict_type,
      "organizationId" AS organization_id,
      "phone" AS identity_value,
      array_agg("id" ORDER BY "createdAt", "id") AS lead_ids
    FROM "Lead"
    WHERE "phone" IS NOT NULL
    GROUP BY "organizationId", "phone"
    HAVING count(*) > 1
  ) AS legacy_conflicts
  ORDER BY conflict_type, organization_id, identity_value
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Phase 3 lead identity migration blocked by legacy duplicates',
      DETAIL = format(
        'type=%s; organizationId=%s; value=%s; leadIds=%s',
        conflict_record.conflict_type,
        conflict_record.organization_id,
        conflict_record.identity_value,
        conflict_record.lead_ids
      ),
      HINT = 'Resolve the listed leads explicitly, then rerun this migration.';
  END IF;
END $$;

-- DropIndex
DROP INDEX "Lead_organizationId_source_externalId_idx";

-- DropIndex
DROP INDEX "Lead_organizationId_domain_idx";

-- DropIndex
DROP INDEX "Lead_organizationId_phone_idx";

-- DropIndex
DROP INDEX "Lead_organizationId_email_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Lead_organizationId_source_externalId_key" ON "Lead"("organizationId", "source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_organizationId_domain_key" ON "Lead"("organizationId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_organizationId_phone_key" ON "Lead"("organizationId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_organizationId_email_key" ON "Lead"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "SearchResult_searchId_externalId_key" ON "SearchResult"("searchId", "externalId");

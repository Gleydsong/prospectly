-- DSR organization scope + backfill from current membership.
ALTER TABLE "DataSubjectRequest" ADD COLUMN "organizationId" TEXT;

UPDATE "DataSubjectRequest" AS d
SET "organizationId" = m."organizationId"
FROM (
  SELECT DISTINCT ON ("userId") "userId", "organizationId"
  FROM "OrganizationMember"
  ORDER BY "userId", "createdAt" DESC
) AS m
WHERE d."userId" = m."userId";

CREATE INDEX "DataSubjectRequest_organizationId_status_idx"
  ON "DataSubjectRequest"("organizationId", "status");

ALTER TABLE "DataSubjectRequest"
  ADD CONSTRAINT "DataSubjectRequest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

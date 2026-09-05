-- Named tenant-owned Lead views. Additive; existing rows are unaffected.

CREATE TYPE "SavedViewVisibility" AS ENUM ('PRIVATE', 'TEAM');
CREATE TYPE "SavedViewResourceType" AS ENUM ('LEAD');

CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "SavedViewVisibility" NOT NULL DEFAULT 'PRIVATE',
    "resourceType" "SavedViewResourceType" NOT NULL DEFAULT 'LEAD',
    "definition" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedView_organizationId_archivedAt_updatedAt_idx" ON "SavedView"("organizationId", "archivedAt", "updatedAt");
CREATE INDEX "SavedView_organizationId_ownerId_visibility_idx" ON "SavedView"("organizationId", "ownerId", "visibility");

ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "SavedView" TO prospectly_app;
ALTER TABLE "SavedView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedView" FORCE ROW LEVEL SECURITY;
CREATE POLICY "SavedView_tenant_isolation" ON "SavedView"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

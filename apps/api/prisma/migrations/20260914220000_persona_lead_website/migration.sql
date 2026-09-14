-- Persona profissional (org default + member override) and LeadWebsite inventory.
-- Do not alter analysis "Website" (1:1). No Client table.

CREATE TYPE "ProfessionalPersona" AS ENUM ('vendedor', 'desenvolvedor', 'trafego_pago', 'marketing', 'outro');
CREATE TYPE "LeadWebsiteKind" AS ENUM ('site', 'landing', 'app');

ALTER TABLE "Organization"
  ADD COLUMN "defaultPersona" "ProfessionalPersona" NOT NULL DEFAULT 'vendedor',
  ADD COLUMN "personaOnboardedAt" TIMESTAMP(3);

UPDATE "Organization"
SET "personaOnboardedAt" = CURRENT_TIMESTAMP
WHERE "personaOnboardedAt" IS NULL;

ALTER TABLE "OrganizationMember"
  ADD COLUMN "personaOverride" "ProfessionalPersona";

CREATE TABLE "LeadWebsite" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "urlNormalized" TEXT NOT NULL,
    "label" TEXT,
    "kind" "LeadWebsiteKind" NOT NULL DEFAULT 'site',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadWebsite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadWebsite_leadId_urlNormalized_key" ON "LeadWebsite"("leadId", "urlNormalized");
CREATE INDEX "LeadWebsite_leadId_idx" ON "LeadWebsite"("leadId");

ALTER TABLE "LeadWebsite" ADD CONSTRAINT "LeadWebsite_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "LeadWebsite" TO prospectly_app;
ALTER TABLE "LeadWebsite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadWebsite" FORCE ROW LEVEL SECURITY;
CREATE POLICY "LeadWebsite_via_lead" ON "LeadWebsite"
  USING (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Lead" p
      WHERE p.id = "LeadWebsite"."leadId" AND p."organizationId" = prospectly_current_org()
    )
  )
  WITH CHECK (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Lead" p
      WHERE p.id = "LeadWebsite"."leadId" AND p."organizationId" = prospectly_current_org()
    )
  );

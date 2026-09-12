-- Flag de organização: toggle tenant allowlisted. Ausência de linha = OFF.

CREATE TABLE "OrganizationFlag" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationFlag_organizationId_key_key"
  ON "OrganizationFlag"("organizationId", "key");
CREATE INDEX "OrganizationFlag_organizationId_idx"
  ON "OrganizationFlag"("organizationId");

ALTER TABLE "OrganizationFlag" ADD CONSTRAINT "OrganizationFlag_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "OrganizationFlag" TO prospectly_app;
ALTER TABLE "OrganizationFlag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationFlag" FORCE ROW LEVEL SECURITY;
CREATE POLICY "OrganizationFlag_tenant_isolation" ON "OrganizationFlag"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

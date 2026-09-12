-- Relatório salvo: recorte nomeado da organização. Totais nunca são persistidos.

CREATE TABLE "SavedReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedReport_organizationId_archivedAt_idx"
  ON "SavedReport"("organizationId", "archivedAt");
CREATE INDEX "SavedReport_organizationId_nameNormalized_idx"
  ON "SavedReport"("organizationId", "nameNormalized");
CREATE UNIQUE INDEX "SavedReport_organizationId_nameNormalized_active_idx"
  ON "SavedReport"("organizationId", "nameNormalized")
  WHERE "archivedAt" IS NULL;

ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "SavedReport" TO prospectly_app;
ALTER TABLE "SavedReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedReport" FORCE ROW LEVEL SECURITY;
CREATE POLICY "SavedReport_tenant_isolation" ON "SavedReport"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

-- Campo personalizado: definição tenant-scoped; valores JSONB no Lead.

CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'DATE');

CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "position" INTEGER NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomFieldDefinition_organizationId_archivedAt_idx"
  ON "CustomFieldDefinition"("organizationId", "archivedAt");
CREATE INDEX "CustomFieldDefinition_organizationId_position_idx"
  ON "CustomFieldDefinition"("organizationId", "position");
CREATE UNIQUE INDEX "CustomFieldDefinition_organizationId_name_active_idx"
  ON "CustomFieldDefinition"("organizationId", "name")
  WHERE "archivedAt" IS NULL;

ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD COLUMN "customFieldValues" JSONB NOT NULL DEFAULT '{}'::jsonb;

GRANT USAGE ON TYPE "CustomFieldType" TO prospectly_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "CustomFieldDefinition" TO prospectly_app;
ALTER TABLE "CustomFieldDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomFieldDefinition" FORCE ROW LEVEL SECURITY;
CREATE POLICY "CustomFieldDefinition_tenant_isolation" ON "CustomFieldDefinition"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

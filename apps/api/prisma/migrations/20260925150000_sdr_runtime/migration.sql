-- Estado do Autonomous SDR por organização. Uma linha. Envio começa desligado no JSON da aplicação.

CREATE TABLE "SdrRuntime" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "view" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SdrRuntime_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SdrRuntime_organizationId_key" ON "SdrRuntime"("organizationId");
CREATE INDEX "SdrRuntime_organizationId_idx" ON "SdrRuntime"("organizationId");

ALTER TABLE "SdrRuntime" ADD CONSTRAINT "SdrRuntime_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "SdrRuntime" TO prospectly_app;
ALTER TABLE "SdrRuntime" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SdrRuntime" FORCE ROW LEVEL SECURITY;
CREATE POLICY "SdrRuntime_tenant_isolation" ON "SdrRuntime"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

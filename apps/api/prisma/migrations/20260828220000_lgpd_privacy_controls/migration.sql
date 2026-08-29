-- LGPD technical controls: account anonymization marker, consent history, hashed suppression list.

ALTER TABLE "User" ADD COLUMN "anonymizedAt" TIMESTAMP(3);

CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "version" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "privacyPolicyVersion" TEXT,
    "termsVersion" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConsentRecord_userId_type_createdAt_idx" ON "ConsentRecord"("userId", "type", "createdAt");

ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SuppressionEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "valueHash" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuppressionEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SuppressionEntry_organizationId_kind_valueHash_key"
  ON "SuppressionEntry"("organizationId", "kind", "valueHash");
CREATE INDEX "SuppressionEntry_organizationId_kind_idx"
  ON "SuppressionEntry"("organizationId", "kind");

ALTER TABLE "SuppressionEntry" ADD CONSTRAINT "SuppressionEntry_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ConsentRecord" TO prospectly_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "SuppressionEntry" TO prospectly_app;

ALTER TABLE "ConsentRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsentRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ConsentRecord_self" ON "ConsentRecord"
  USING (prospectly_rls_bypass() OR "userId" = prospectly_current_user())
  WITH CHECK (prospectly_rls_bypass() OR "userId" = prospectly_current_user());

ALTER TABLE "SuppressionEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SuppressionEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY "SuppressionEntry_tenant_isolation" ON "SuppressionEntry"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

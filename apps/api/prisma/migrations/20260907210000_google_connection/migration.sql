-- Conexão Google: OAuth per-user (Gmail/Calendar read). Not Integration.

CREATE TABLE "GoogleConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleSubject" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "scopes" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleConnection_organizationId_userId_key"
  ON "GoogleConnection"("organizationId", "userId");
CREATE INDEX "GoogleConnection_organizationId_revokedAt_idx"
  ON "GoogleConnection"("organizationId", "revokedAt");
CREATE INDEX "GoogleConnection_userId_idx"
  ON "GoogleConnection"("userId");

ALTER TABLE "GoogleConnection" ADD CONSTRAINT "GoogleConnection_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleConnection" ADD CONSTRAINT "GoogleConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "GoogleConnection" TO prospectly_app;
ALTER TABLE "GoogleConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GoogleConnection" FORCE ROW LEVEL SECURITY;
CREATE POLICY "GoogleConnection_tenant_isolation" ON "GoogleConnection"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

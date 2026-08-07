CREATE TABLE "PluginToken" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PluginToken_tokenHash_key" ON "PluginToken"("tokenHash");
CREATE INDEX "PluginToken_organizationId_revokedAt_idx" ON "PluginToken"("organizationId", "revokedAt");

ALTER TABLE "PluginToken" ADD CONSTRAINT "PluginToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

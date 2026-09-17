-- Ligação MCP + Authorization Server (OAuth 2.1). OauthClient is a global MCP client catalog.

CREATE TABLE "OauthClient" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "redirectUris" JSONB NOT NULL,
    "tokenEndpointAuthMethod" TEXT NOT NULL DEFAULT 'none',
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OauthClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "McpConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OauthAuthorizationCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OauthAuthorizationCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OauthAccessToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OauthAccessToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OauthRefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "accessTokenId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OauthRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OauthAuthorizationCode_codeHash_key" ON "OauthAuthorizationCode"("codeHash");
CREATE UNIQUE INDEX "OauthAccessToken_tokenHash_key" ON "OauthAccessToken"("tokenHash");
CREATE UNIQUE INDEX "OauthRefreshToken_tokenHash_key" ON "OauthRefreshToken"("tokenHash");
CREATE UNIQUE INDEX "OauthRefreshToken_accessTokenId_key" ON "OauthRefreshToken"("accessTokenId");

CREATE INDEX "McpConnection_organizationId_revokedAt_idx" ON "McpConnection"("organizationId", "revokedAt");
CREATE INDEX "McpConnection_userId_idx" ON "McpConnection"("userId");
CREATE INDEX "McpConnection_clientId_idx" ON "McpConnection"("clientId");
CREATE INDEX "OauthAuthorizationCode_organizationId_idx" ON "OauthAuthorizationCode"("organizationId");
CREATE INDEX "OauthAuthorizationCode_expiresAt_idx" ON "OauthAuthorizationCode"("expiresAt");
CREATE INDEX "OauthAccessToken_organizationId_idx" ON "OauthAccessToken"("organizationId");
CREATE INDEX "OauthAccessToken_connectionId_idx" ON "OauthAccessToken"("connectionId");
CREATE INDEX "OauthAccessToken_expiresAt_idx" ON "OauthAccessToken"("expiresAt");
CREATE INDEX "OauthRefreshToken_organizationId_idx" ON "OauthRefreshToken"("organizationId");
CREATE INDEX "OauthRefreshToken_connectionId_idx" ON "OauthRefreshToken"("connectionId");
CREATE INDEX "OauthRefreshToken_expiresAt_idx" ON "OauthRefreshToken"("expiresAt");

ALTER TABLE "McpConnection" ADD CONSTRAINT "McpConnection_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McpConnection" ADD CONSTRAINT "McpConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McpConnection" ADD CONSTRAINT "McpConnection_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "OauthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OauthAuthorizationCode" ADD CONSTRAINT "OauthAuthorizationCode_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "OauthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OauthAuthorizationCode" ADD CONSTRAINT "OauthAuthorizationCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OauthAuthorizationCode" ADD CONSTRAINT "OauthAuthorizationCode_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OauthAuthorizationCode" ADD CONSTRAINT "OauthAuthorizationCode_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "McpConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OauthAccessToken" ADD CONSTRAINT "OauthAccessToken_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "OauthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OauthAccessToken" ADD CONSTRAINT "OauthAccessToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OauthAccessToken" ADD CONSTRAINT "OauthAccessToken_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OauthAccessToken" ADD CONSTRAINT "OauthAccessToken_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "McpConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OauthRefreshToken" ADD CONSTRAINT "OauthRefreshToken_accessTokenId_fkey"
  FOREIGN KEY ("accessTokenId") REFERENCES "OauthAccessToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OauthRefreshToken" ADD CONSTRAINT "OauthRefreshToken_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "McpConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OauthRefreshToken" ADD CONSTRAINT "OauthRefreshToken_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "OauthClient" TO prospectly_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "McpConnection" TO prospectly_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "OauthAuthorizationCode" TO prospectly_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "OauthAccessToken" TO prospectly_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "OauthRefreshToken" TO prospectly_app;

ALTER TABLE "OauthClient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OauthClient" FORCE ROW LEVEL SECURITY;
CREATE POLICY "OauthClient_app_access" ON "OauthClient"
  USING (true)
  WITH CHECK (true);

ALTER TABLE "McpConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "McpConnection" FORCE ROW LEVEL SECURITY;
CREATE POLICY "McpConnection_tenant_isolation" ON "McpConnection"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

ALTER TABLE "OauthAuthorizationCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OauthAuthorizationCode" FORCE ROW LEVEL SECURITY;
CREATE POLICY "OauthAuthorizationCode_tenant_isolation" ON "OauthAuthorizationCode"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

ALTER TABLE "OauthAccessToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OauthAccessToken" FORCE ROW LEVEL SECURITY;
CREATE POLICY "OauthAccessToken_tenant_isolation" ON "OauthAccessToken"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

ALTER TABLE "OauthRefreshToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OauthRefreshToken" FORCE ROW LEVEL SECURITY;
CREATE POLICY "OauthRefreshToken_tenant_isolation" ON "OauthRefreshToken"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

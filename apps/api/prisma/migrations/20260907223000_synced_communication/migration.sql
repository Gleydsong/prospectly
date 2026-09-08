-- Comunicação sincronizada: metadados Gmail/Calendar no Lead. Não é LeadActivity.

CREATE TYPE "SyncedCommunicationChannel" AS ENUM ('EMAIL', 'CALENDAR');
CREATE TYPE "SyncedCommunicationDirection" AS ENUM ('IN', 'OUT', 'EVENT');

CREATE TABLE "SyncedCommunication" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "channel" "SyncedCommunicationChannel" NOT NULL,
    "externalId" TEXT NOT NULL,
    "threadId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "direction" "SyncedCommunicationDirection" NOT NULL,
    "fromAddresses" JSONB NOT NULL,
    "toAddresses" JSONB NOT NULL,
    "ccAddresses" JSONB NOT NULL,
    "subject" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "htmlLink" TEXT NOT NULL,
    "ingestedByConnectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncedCommunication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SyncedCommunication_organizationId_leadId_channel_externalId_key"
  ON "SyncedCommunication"("organizationId", "leadId", "channel", "externalId");
CREATE INDEX "SyncedCommunication_organizationId_leadId_occurredAt_idx"
  ON "SyncedCommunication"("organizationId", "leadId", "occurredAt");
CREATE INDEX "SyncedCommunication_leadId_occurredAt_idx"
  ON "SyncedCommunication"("leadId", "occurredAt");

ALTER TABLE "SyncedCommunication" ADD CONSTRAINT "SyncedCommunication_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncedCommunication" ADD CONSTRAINT "SyncedCommunication_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncedCommunication" ADD CONSTRAINT "SyncedCommunication_ingestedByConnectionId_fkey"
  FOREIGN KEY ("ingestedByConnectionId") REFERENCES "GoogleConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "SyncedCommunication" TO prospectly_app;
ALTER TABLE "SyncedCommunication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncedCommunication" FORCE ROW LEVEL SECURITY;
CREATE POLICY "SyncedCommunication_tenant_isolation" ON "SyncedCommunication"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

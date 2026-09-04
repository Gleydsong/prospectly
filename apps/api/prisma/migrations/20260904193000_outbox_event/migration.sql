-- Durable domain events with delivery state. Additive; existing rows are unaffected.

CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD');

CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "actorId" TEXT,
    "correlationId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "jobDispatchedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "retainUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutboxEvent_organizationId_idempotencyKey_key" ON "OutboxEvent"("organizationId", "idempotencyKey");
CREATE INDEX "OutboxEvent_organizationId_status_createdAt_idx" ON "OutboxEvent"("organizationId", "status", "createdAt");
CREATE INDEX "OutboxEvent_status_jobDispatchedAt_idx" ON "OutboxEvent"("status", "jobDispatchedAt");
CREATE INDEX "OutboxEvent_status_retainUntil_idx" ON "OutboxEvent"("status", "retainUntil");
CREATE INDEX "OutboxEvent_retainUntil_idx" ON "OutboxEvent"("retainUntil");
CREATE INDEX "OutboxEvent_organizationId_type_aggregateId_idx" ON "OutboxEvent"("organizationId", "type", "aggregateId");

ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "OutboxEvent" TO prospectly_app;
ALTER TABLE "OutboxEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OutboxEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY "OutboxEvent_tenant_isolation" ON "OutboxEvent"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

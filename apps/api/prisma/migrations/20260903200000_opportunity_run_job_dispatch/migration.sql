-- Durable dispatch watermark so Opportunity Finder runs survive Redis loss.
-- Additive and nullable: existing rows stay recoverable as undispatched.

ALTER TABLE "OpportunityRun" ADD COLUMN "jobDispatchedAt" TIMESTAMP(3);

CREATE INDEX "OpportunityRun_status_jobDispatchedAt_idx" ON "OpportunityRun"("status", "jobDispatchedAt");

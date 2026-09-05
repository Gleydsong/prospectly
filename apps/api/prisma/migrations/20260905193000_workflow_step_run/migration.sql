-- Idempotent Fluxo step runs. Additive; existing rows are unaffected.

CREATE TYPE "WorkflowStepRunOutcome" AS ENUM ('APPLIED', 'SKIPPED');

CREATE TABLE "WorkflowStepRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowVersionId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "outcome" "WorkflowStepRunOutcome" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowStepRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowStepRun_workflowVersionId_eventId_stepIndex_key"
  ON "WorkflowStepRun"("workflowVersionId", "eventId", "stepIndex");
CREATE INDEX "WorkflowStepRun_organizationId_eventId_idx"
  ON "WorkflowStepRun"("organizationId", "eventId");

ALTER TABLE "WorkflowStepRun" ADD CONSTRAINT "WorkflowStepRun_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowStepRun" ADD CONSTRAINT "WorkflowStepRun_workflowVersionId_fkey"
  FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "WorkflowStepRun" TO prospectly_app;
ALTER TABLE "WorkflowStepRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowStepRun" FORCE ROW LEVEL SECURITY;
CREATE POLICY "WorkflowStepRun_tenant_isolation" ON "WorkflowStepRun"
  USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org());

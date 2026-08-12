CREATE TYPE "OpportunityRunStatus" AS ENUM (
  'IDLE', 'PREPARING', 'SEARCHING', 'ANALYZING', 'RANKING',
  'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'
);

CREATE TYPE "OpportunityCandidateStatus" AS ENUM (
  'DISCOVERED', 'ANALYZING', 'SCORED', 'FAILED'
);

CREATE TYPE "AiRunStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

ALTER TABLE "WebsiteAnalysis" ADD COLUMN "hasBooking" BOOLEAN;

CREATE TABLE "OpportunityRun" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "OpportunityRunStatus" NOT NULL DEFAULT 'PREPARING',
  "service" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'BR',
  "profile" JSONB,
  "searchStrategy" JSONB,
  "scoringVersion" TEXT NOT NULL DEFAULT 'opportunity-score-v1',
  "profilePromptVersion" TEXT,
  "strategyPromptVersion" TEXT,
  "candidateCount" INTEGER NOT NULL DEFAULT 0,
  "analyzedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "correlationId" TEXT,
  "idempotencyKey" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpportunityRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpportunityCandidate" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "status" "OpportunityCandidateStatus" NOT NULL DEFAULT 'DISCOVERED',
  "externalId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "company" JSONB NOT NULL,
  "websiteAnalysis" JSONB,
  "signals" JSONB NOT NULL,
  "scoreBreakdown" JSONB NOT NULL,
  "overallScore" INTEGER NOT NULL,
  "confidenceScore" INTEGER NOT NULL,
  "dataCompleteness" INTEGER NOT NULL,
  "rankingCategory" TEXT NOT NULL,
  "explanation" JSONB,
  "explanationPromptVersion" TEXT,
  "importedLeadId" TEXT,
  "analyzedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpportunityCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiRun" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "opportunityRunId" TEXT,
  "candidateId" TEXT,
  "task" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "status" "AiRunStatus" NOT NULL DEFAULT 'PENDING',
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "durationMs" INTEGER,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpportunityRun_organizationId_idempotencyKey_key"
  ON "OpportunityRun"("organizationId", "idempotencyKey");
CREATE INDEX "OpportunityRun_organizationId_createdAt_idx" ON "OpportunityRun"("organizationId", "createdAt");
CREATE INDEX "OpportunityRun_organizationId_status_idx" ON "OpportunityRun"("organizationId", "status");
CREATE INDEX "OpportunityRun_userId_createdAt_idx" ON "OpportunityRun"("userId", "createdAt");
CREATE UNIQUE INDEX "OpportunityCandidate_runId_externalId_key" ON "OpportunityCandidate"("runId", "externalId");
CREATE INDEX "OpportunityCandidate_runId_overallScore_confidenceScore_idx"
  ON "OpportunityCandidate"("runId", "overallScore", "confidenceScore");
CREATE INDEX "OpportunityCandidate_importedLeadId_idx" ON "OpportunityCandidate"("importedLeadId");
CREATE INDEX "AiRun_organizationId_createdAt_idx" ON "AiRun"("organizationId", "createdAt");
CREATE INDEX "AiRun_opportunityRunId_idx" ON "AiRun"("opportunityRunId");
CREATE INDEX "AiRun_candidateId_idx" ON "AiRun"("candidateId");
CREATE INDEX "AiRun_task_status_createdAt_idx" ON "AiRun"("task", "status", "createdAt");

ALTER TABLE "OpportunityRun" ADD CONSTRAINT "OpportunityRun_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityRun" ADD CONSTRAINT "OpportunityRun_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityCandidate" ADD CONSTRAINT "OpportunityCandidate_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "OpportunityRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityCandidate" ADD CONSTRAINT "OpportunityCandidate_importedLeadId_fkey"
  FOREIGN KEY ("importedLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_opportunityRunId_fkey"
  FOREIGN KEY ("opportunityRunId") REFERENCES "OpportunityRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "OpportunityCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreditLedgerEntry" ADD COLUMN "opportunityRunId" TEXT;
CREATE INDEX "CreditLedgerEntry_opportunityRunId_idx" ON "CreditLedgerEntry"("opportunityRunId");
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_opportunityRunId_fkey"
  FOREIGN KEY ("opportunityRunId") REFERENCES "OpportunityRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpportunityRun" ADD CONSTRAINT "OpportunityRun_country_check" CHECK ("country" = 'BR');
ALTER TABLE "OpportunityRun" ADD CONSTRAINT "OpportunityRun_counts_check"
  CHECK ("candidateCount" >= 0 AND "analyzedCount" >= 0 AND "failedCount" >= 0);
ALTER TABLE "OpportunityCandidate" ADD CONSTRAINT "OpportunityCandidate_scores_check"
  CHECK (
    "overallScore" BETWEEN 0 AND 100 AND
    "confidenceScore" BETWEEN 0 AND 100 AND
    "dataCompleteness" BETWEEN 0 AND 100
  );

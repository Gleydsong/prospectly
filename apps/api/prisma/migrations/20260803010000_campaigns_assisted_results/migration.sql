-- Assisted campaigns: lead results, task idempotency keys, activity events.
-- Local-only migration; does not enable auto-send.

CREATE TYPE "CampaignLeadResult" AS ENUM (
  'CONTACTED',
  'REPLIED',
  'INTERESTED',
  'MEETING',
  'PROPOSAL',
  'WON',
  'LOST',
  'NO_RESPONSE',
  'OPT_OUT'
);

ALTER TABLE "CampaignLead"
  ADD COLUMN "currentStageId" TEXT,
  ADD COLUMN "result" "CampaignLeadResult",
  ADD COLUMN "lastContactedAt" TIMESTAMP(3),
  ADD COLUMN "nextFollowUpAt" TIMESTAMP(3),
  ADD COLUMN "nextAction" TEXT;

CREATE INDEX "CampaignLead_campaignId_status_idx" ON "CampaignLead"("campaignId", "status");
CREATE INDEX "CampaignLead_campaignId_currentStageId_idx" ON "CampaignLead"("campaignId", "currentStageId");

ALTER TABLE "Task"
  ADD COLUMN "campaignId" TEXT,
  ADD COLUMN "campaignStageId" TEXT;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Task_campaignId_campaignStageId_leadId_key"
  ON "Task"("campaignId", "campaignStageId", "leadId");

CREATE INDEX "Task_campaignId_campaignStageId_idx"
  ON "Task"("campaignId", "campaignStageId");

CREATE TABLE "CampaignActivity" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stageId" TEXT,
  "result" "CampaignLeadResult" NOT NULL,
  "note" TEXT,
  "nextAction" TEXT,
  "followUpAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CampaignActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CampaignActivity_campaignId_createdAt_idx"
  ON "CampaignActivity"("campaignId", "createdAt");

CREATE INDEX "CampaignActivity_organizationId_createdAt_idx"
  ON "CampaignActivity"("organizationId", "createdAt");

CREATE INDEX "CampaignActivity_leadId_createdAt_idx"
  ON "CampaignActivity"("leadId", "createdAt");

ALTER TABLE "CampaignActivity"
  ADD CONSTRAINT "CampaignActivity_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignActivity"
  ADD CONSTRAINT "CampaignActivity_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignActivity"
  ADD CONSTRAINT "CampaignActivity_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignActivity"
  ADD CONSTRAINT "CampaignActivity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

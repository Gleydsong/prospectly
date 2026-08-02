import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('campaigns assisted results migration', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '../../../prisma/migrations/20260803010000_campaigns_assisted_results/migration.sql',
    ),
    'utf8',
  );

  it('creates CampaignLeadResult enum and CampaignActivity table', () => {
    expect(sql).toContain('CREATE TYPE "CampaignLeadResult"');
    expect(sql).toContain('CREATE TABLE "CampaignActivity"');
    expect(sql).toContain('OPT_OUT');
  });

  it('adds idempotency unique key on Task campaign fields', () => {
    expect(sql).toContain('Task_campaignId_campaignStageId_leadId_key');
    expect(sql).toContain('ADD COLUMN "campaignId"');
    expect(sql).toContain('ADD COLUMN "campaignStageId"');
  });

  it('extends CampaignLead with result and follow-up fields', () => {
    expect(sql).toContain('"currentStageId"');
    expect(sql).toContain('"lastContactedAt"');
    expect(sql).toContain('"nextFollowUpAt"');
    expect(sql).toContain('"nextAction"');
  });
});

-- Runtime role without LOGIN or BYPASSRLS. Table owner / superuser is used for migrate + seed.
-- Provision LOGIN with an externally managed secret before setting DATABASE_APP_URL.
-- Rollback: DROP POLICY on each table; ALTER TABLE ... DISABLE ROW LEVEL SECURITY; DROP ROLE prospectly_app (after REASSIGN).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'prospectly_app') THEN
    CREATE ROLE prospectly_app NOLOGIN
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO prospectly_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO prospectly_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO prospectly_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO prospectly_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO prospectly_app;
GRANT prospectly_app TO CURRENT_USER;

CREATE OR REPLACE FUNCTION prospectly_rls_bypass() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.rls_bypass', true) = 'on'
$$;

CREATE OR REPLACE FUNCTION prospectly_current_org() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')
$$;

CREATE OR REPLACE FUNCTION prospectly_current_user() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')
$$;

-- Tenant tables keyed by "organizationId"
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Lead',
    'Tag',
    'LeadActivity',
    'Task',
    'Pipeline',
    'Search',
    'Import',
    'Campaign',
    'CampaignActivity',
    'MessageTemplate',
    'Integration',
    'PluginToken',
    'AuditLog',
    'ScoreConfiguration',
    'UsageLedger',
    'CreditPurchase',
    'CreditLedgerEntry',
    'OpportunityRun',
    'AiRun',
    'DataSubjectRequest'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I
        USING (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())
        WITH CHECK (prospectly_rls_bypass() OR "organizationId" = prospectly_current_org())',
      t || '_tenant_isolation',
      t
    );
  END LOOP;
END
$$;

ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY;
CREATE POLICY "Organization_tenant_isolation" ON "Organization"
  USING (prospectly_rls_bypass() OR id = prospectly_current_org())
  WITH CHECK (prospectly_rls_bypass() OR id = prospectly_current_org());

ALTER TABLE "OrganizationMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationMember" FORCE ROW LEVEL SECURITY;
CREATE POLICY "OrganizationMember_tenant_or_self" ON "OrganizationMember"
  USING (
    prospectly_rls_bypass()
    OR "organizationId" = prospectly_current_org()
    OR "userId" = prospectly_current_user()
  )
  WITH CHECK (
    prospectly_rls_bypass()
    OR "organizationId" = prospectly_current_org()
    OR "userId" = prospectly_current_user()
  );

-- Child tables (no organizationId) — exist via parent org
ALTER TABLE "LeadContact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadContact" FORCE ROW LEVEL SECURITY;
CREATE POLICY "LeadContact_via_lead" ON "LeadContact"
  USING (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Lead" p
      WHERE p.id = "LeadContact"."leadId" AND p."organizationId" = prospectly_current_org()
    )
  )
  WITH CHECK (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Lead" p
      WHERE p.id = "LeadContact"."leadId" AND p."organizationId" = prospectly_current_org()
    )
  );

ALTER TABLE "LeadTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadTag" FORCE ROW LEVEL SECURITY;
CREATE POLICY "LeadTag_via_lead" ON "LeadTag"
  USING (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Lead" p
      WHERE p.id = "LeadTag"."leadId" AND p."organizationId" = prospectly_current_org()
    )
  )
  WITH CHECK (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Lead" p
      WHERE p.id = "LeadTag"."leadId" AND p."organizationId" = prospectly_current_org()
    )
  );

ALTER TABLE "PipelineStage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PipelineStage" FORCE ROW LEVEL SECURITY;
CREATE POLICY "PipelineStage_via_pipeline" ON "PipelineStage"
  USING (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Pipeline" p
      WHERE p.id = "PipelineStage"."pipelineId" AND p."organizationId" = prospectly_current_org()
    )
  )
  WITH CHECK (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Pipeline" p
      WHERE p.id = "PipelineStage"."pipelineId" AND p."organizationId" = prospectly_current_org()
    )
  );

ALTER TABLE "Website" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Website" FORCE ROW LEVEL SECURITY;
CREATE POLICY "Website_via_lead" ON "Website"
  USING (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Lead" p
      WHERE p.id = "Website"."leadId" AND p."organizationId" = prospectly_current_org()
    )
  )
  WITH CHECK (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Lead" p
      WHERE p.id = "Website"."leadId" AND p."organizationId" = prospectly_current_org()
    )
  );

ALTER TABLE "WebsiteAnalysis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebsiteAnalysis" FORCE ROW LEVEL SECURITY;
CREATE POLICY "WebsiteAnalysis_via_website" ON "WebsiteAnalysis"
  USING (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Website" w
      JOIN "Lead" p ON p.id = w."leadId"
      WHERE w.id = "WebsiteAnalysis"."websiteId" AND p."organizationId" = prospectly_current_org()
    )
  )
  WITH CHECK (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Website" w
      JOIN "Lead" p ON p.id = w."leadId"
      WHERE w.id = "WebsiteAnalysis"."websiteId" AND p."organizationId" = prospectly_current_org()
    )
  );

ALTER TABLE "WebsiteAnalysisIssue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebsiteAnalysisIssue" FORCE ROW LEVEL SECURITY;
CREATE POLICY "WebsiteAnalysisIssue_via_analysis" ON "WebsiteAnalysisIssue"
  USING (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "WebsiteAnalysis" a
      JOIN "Website" w ON w.id = a."websiteId"
      JOIN "Lead" p ON p.id = w."leadId"
      WHERE a.id = "WebsiteAnalysisIssue"."analysisId" AND p."organizationId" = prospectly_current_org()
    )
  )
  WITH CHECK (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "WebsiteAnalysis" a
      JOIN "Website" w ON w.id = a."websiteId"
      JOIN "Lead" p ON p.id = w."leadId"
      WHERE a.id = "WebsiteAnalysisIssue"."analysisId" AND p."organizationId" = prospectly_current_org()
    )
  );

ALTER TABLE "ScoreRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScoreRule" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ScoreRule_via_config" ON "ScoreRule"
  USING (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "ScoreConfiguration" p
      WHERE p.id = "ScoreRule"."configId" AND p."organizationId" = prospectly_current_org()
    )
  )
  WITH CHECK (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "ScoreConfiguration" p
      WHERE p.id = "ScoreRule"."configId" AND p."organizationId" = prospectly_current_org()
    )
  );

ALTER TABLE "LeadScore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadScore" FORCE ROW LEVEL SECURITY;
CREATE POLICY "LeadScore_via_lead" ON "LeadScore"
  USING (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Lead" p
      WHERE p.id = "LeadScore"."leadId" AND p."organizationId" = prospectly_current_org()
    )
  )
  WITH CHECK (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Lead" p
      WHERE p.id = "LeadScore"."leadId" AND p."organizationId" = prospectly_current_org()
    )
  );

ALTER TABLE "SearchResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SearchResult" FORCE ROW LEVEL SECURITY;
CREATE POLICY "SearchResult_via_search" ON "SearchResult"
  USING (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Search" p
      WHERE p.id = "SearchResult"."searchId" AND p."organizationId" = prospectly_current_org()
    )
  )
  WITH CHECK (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Search" p
      WHERE p.id = "SearchResult"."searchId" AND p."organizationId" = prospectly_current_org()
    )
  );

ALTER TABLE "ImportError" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportError" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ImportError_via_import" ON "ImportError"
  USING (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Import" p
      WHERE p.id = "ImportError"."importId" AND p."organizationId" = prospectly_current_org()
    )
  )
  WITH CHECK (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Import" p
      WHERE p.id = "ImportError"."importId" AND p."organizationId" = prospectly_current_org()
    )
  );

ALTER TABLE "CampaignLead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CampaignLead" FORCE ROW LEVEL SECURITY;
CREATE POLICY "CampaignLead_via_campaign" ON "CampaignLead"
  USING (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Campaign" p
      WHERE p.id = "CampaignLead"."campaignId" AND p."organizationId" = prospectly_current_org()
    )
  )
  WITH CHECK (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Campaign" p
      WHERE p.id = "CampaignLead"."campaignId" AND p."organizationId" = prospectly_current_org()
    )
  );

ALTER TABLE "OpportunityCandidate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OpportunityCandidate" FORCE ROW LEVEL SECURITY;
CREATE POLICY "OpportunityCandidate_via_run" ON "OpportunityCandidate"
  USING (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "OpportunityRun" p
      WHERE p.id = "OpportunityCandidate"."runId" AND p."organizationId" = prospectly_current_org()
    )
  )
  WITH CHECK (
    prospectly_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "OpportunityRun" p
      WHERE p.id = "OpportunityCandidate"."runId" AND p."organizationId" = prospectly_current_org()
    )
  );

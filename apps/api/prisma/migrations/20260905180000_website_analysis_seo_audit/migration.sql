-- SEO opportunity audit on WebsiteAnalysis. Additive; existing rows keep NULLs until re-analysed.

CREATE TYPE "SeoOpportunityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

ALTER TABLE "WebsiteAnalysis"
    ADD COLUMN "seoHealthScore" INTEGER,
    ADD COLUMN "seoOpportunity" "SeoOpportunityLevel",
    ADD COLUMN "architecture" TEXT,
    ADD COLUMN "seoAudit" JSONB;

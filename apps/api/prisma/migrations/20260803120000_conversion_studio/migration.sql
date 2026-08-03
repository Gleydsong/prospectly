-- Conversion Studio: pages, versions, events, form submissions, usage ledger, domain bindings.

CREATE TYPE "ConversionPageStatus" AS ENUM ('DRAFT', 'PREVIEW', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ConversionEventType" AS ENUM (
  'page_view',
  'cta_click',
  'form_started',
  'form_submitted',
  'page_published',
  'page_unpublished',
  'page_version_restored'
);
CREATE TYPE "UsageMeterKey" AS ENUM (
  'SEARCHES',
  'PUBLISHED_PAGES',
  'PAGE_DRAFTS',
  'VERSION_HISTORY',
  'CSV_EXPORT',
  'AI_GENERATIONS'
);

CREATE TABLE "ConversionPage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "title" TEXT NOT NULL,
    "status" "ConversionPageStatus" NOT NULL DEFAULT 'DRAFT',
    "publicSlug" TEXT NOT NULL,
    "publishedVersion" INTEGER,
    "draftRevision" INTEGER NOT NULL DEFAULT 1,
    "draftBlocks" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "updatedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ConversionPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversionPageVersion" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "blocks" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "createdById" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversionPageVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversionPageAsset" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "contentType" TEXT,
    "byteSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversionPageAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversionEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "version" INTEGER,
    "type" "ConversionEventType" NOT NULL,
    "metadata" JSONB,
    "channel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversionEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversionFormSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "version" INTEGER,
    "payload" JSONB NOT NULL,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversionFormSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DomainBinding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "pageId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainBinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageLedger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "meterKey" "UsageMeterKey" NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConversionPage_publicSlug_key" ON "ConversionPage"("publicSlug");
CREATE INDEX "ConversionPage_organizationId_status_idx" ON "ConversionPage"("organizationId", "status");
CREATE INDEX "ConversionPage_organizationId_leadId_idx" ON "ConversionPage"("organizationId", "leadId");
CREATE INDEX "ConversionPage_organizationId_updatedAt_idx" ON "ConversionPage"("organizationId", "updatedAt");
CREATE INDEX "ConversionPage_organizationId_deletedAt_idx" ON "ConversionPage"("organizationId", "deletedAt");

CREATE UNIQUE INDEX "ConversionPageVersion_pageId_version_key" ON "ConversionPageVersion"("pageId", "version");
CREATE INDEX "ConversionPageVersion_organizationId_pageId_idx" ON "ConversionPageVersion"("organizationId", "pageId");
CREATE INDEX "ConversionPageVersion_organizationId_createdAt_idx" ON "ConversionPageVersion"("organizationId", "createdAt");

CREATE INDEX "ConversionPageAsset_organizationId_pageId_idx" ON "ConversionPageAsset"("organizationId", "pageId");

CREATE INDEX "ConversionEvent_organizationId_pageId_createdAt_idx" ON "ConversionEvent"("organizationId", "pageId", "createdAt");
CREATE INDEX "ConversionEvent_organizationId_type_createdAt_idx" ON "ConversionEvent"("organizationId", "type", "createdAt");
CREATE INDEX "ConversionEvent_pageId_type_createdAt_idx" ON "ConversionEvent"("pageId", "type", "createdAt");

CREATE INDEX "ConversionFormSubmission_organizationId_pageId_createdAt_idx" ON "ConversionFormSubmission"("organizationId", "pageId", "createdAt");
CREATE INDEX "ConversionFormSubmission_pageId_createdAt_idx" ON "ConversionFormSubmission"("pageId", "createdAt");

CREATE UNIQUE INDEX "DomainBinding_hostname_key" ON "DomainBinding"("hostname");
CREATE INDEX "DomainBinding_organizationId_idx" ON "DomainBinding"("organizationId");

CREATE UNIQUE INDEX "UsageLedger_organizationId_idempotencyKey_key" ON "UsageLedger"("organizationId", "idempotencyKey");
CREATE INDEX "UsageLedger_organizationId_meterKey_createdAt_idx" ON "UsageLedger"("organizationId", "meterKey", "createdAt");

ALTER TABLE "ConversionPage" ADD CONSTRAINT "ConversionPage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversionPage" ADD CONSTRAINT "ConversionPage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversionPageVersion" ADD CONSTRAINT "ConversionPageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ConversionPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversionPageAsset" ADD CONSTRAINT "ConversionPageAsset_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ConversionPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ConversionPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversionFormSubmission" ADD CONSTRAINT "ConversionFormSubmission_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ConversionPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DomainBinding" ADD CONSTRAINT "DomainBinding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageLedger" ADD CONSTRAINT "UsageLedger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AI landing generation status fields on ConversionPage.

CREATE TYPE "ConversionGenerationStatus" AS ENUM ('IDLE', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "ConversionGenerationMode" AS ENUM (
  'TEMPLATE',
  'AI_LEAD',
  'AI_DESCRIBE',
  'AI_GOOGLE',
  'AI_REFINE',
  'TEMPLATE_FALLBACK'
);

ALTER TABLE "ConversionPage"
  ADD COLUMN IF NOT EXISTS "generationStatus" "ConversionGenerationStatus" NOT NULL DEFAULT 'IDLE',
  ADD COLUMN IF NOT EXISTS "generationMode" "ConversionGenerationMode",
  ADD COLUMN IF NOT EXISTS "generationError" TEXT,
  ADD COLUMN IF NOT EXISTS "generationStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "generationFinishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "generationPromptVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "generationInput" JSONB;

CREATE INDEX IF NOT EXISTS "ConversionPage_organizationId_generationStatus_idx"
  ON "ConversionPage"("organizationId", "generationStatus");

-- Conversion Studio ops: analytics consent flags + domain verification token.

ALTER TABLE "ConversionPage"
  ADD COLUMN IF NOT EXISTS "analyticsPixelEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "analyticsConsentLabel" TEXT;

ALTER TABLE "DomainBinding"
  ADD COLUMN IF NOT EXISTS "verificationToken" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "lastCheckedAt" TIMESTAMP(3);

UPDATE "DomainBinding"
SET "verificationToken" = md5(random()::text || id || clock_timestamp()::text)
WHERE "verificationToken" = '';

ALTER TABLE "DomainBinding"
  ALTER COLUMN "verificationToken" DROP DEFAULT;

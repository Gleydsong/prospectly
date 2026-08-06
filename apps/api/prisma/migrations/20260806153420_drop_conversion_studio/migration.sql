-- Drop Conversion Studio tables and enums (Prospectly Pages removed).
DROP TABLE IF EXISTS "ConversionFormSubmission" CASCADE;
DROP TABLE IF EXISTS "ConversionEvent" CASCADE;
DROP TABLE IF EXISTS "ConversionPageAsset" CASCADE;
DROP TABLE IF EXISTS "ConversionPageVersion" CASCADE;
DROP TABLE IF EXISTS "ConversionPage" CASCADE;
DROP TABLE IF EXISTS "DomainBinding" CASCADE;

DROP TYPE IF EXISTS "ConversionPageStatus";
DROP TYPE IF EXISTS "ConversionPageTemplate";
DROP TYPE IF EXISTS "ConversionGenerationStatus";
DROP TYPE IF EXISTS "ConversionGenerationMode";
DROP TYPE IF EXISTS "ConversionEventType";

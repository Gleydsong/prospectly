CREATE TYPE "ConversionPageTemplate" AS ENUM ('HTML', 'AURORA');

ALTER TABLE "ConversionPage"
  ADD COLUMN "draftTemplate" "ConversionPageTemplate" NOT NULL DEFAULT 'HTML';

ALTER TABLE "ConversionPageVersion"
  ADD COLUMN "template" "ConversionPageTemplate" NOT NULL DEFAULT 'HTML';

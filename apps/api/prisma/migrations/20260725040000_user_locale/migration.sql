-- AlterEnum
CREATE TYPE "AppLocale" AS ENUM ('pt', 'en');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "locale" "AppLocale" NOT NULL DEFAULT 'pt';

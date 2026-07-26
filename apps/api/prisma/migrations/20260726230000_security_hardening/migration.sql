-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyTokenExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RefreshToken_organizationId_idx" ON "RefreshToken"("organizationId");

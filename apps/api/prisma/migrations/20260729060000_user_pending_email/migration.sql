-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pendingEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_pendingEmail_key" ON "User"("pendingEmail");

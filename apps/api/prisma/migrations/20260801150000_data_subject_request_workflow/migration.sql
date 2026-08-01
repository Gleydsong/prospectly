-- AlterTable
ALTER TABLE "DataSubjectRequest" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;
ALTER TABLE "DataSubjectRequest" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "DataSubjectRequest" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "DataSubjectRequest" ADD COLUMN IF NOT EXISTS "confirmationSentAt" TIMESTAMP(3);
ALTER TABLE "DataSubjectRequest" ADD COLUMN IF NOT EXISTS "confirmationChannel" TEXT;
ALTER TABLE "DataSubjectRequest" ADD COLUMN IF NOT EXISTS "confirmationNote" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DataSubjectRequest_status_createdAt_idx" ON "DataSubjectRequest"("status", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "DataSubjectRequest"
    ADD CONSTRAINT "DataSubjectRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

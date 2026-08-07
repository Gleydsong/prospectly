-- AlterEnum
ALTER TYPE "CreditLedgerReason" ADD VALUE 'SIGNUP_BONUS';

-- AlterTable: new orgs start with experience credits (existing balances unchanged)
ALTER TABLE "Organization" ALTER COLUMN "creditBalance" SET DEFAULT 400;

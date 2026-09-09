-- Drop tenant outbound webhook rows (signing secrets lived in Integration.config).
DELETE FROM "Integration" WHERE provider = 'WEBHOOK';

ALTER TABLE "OutboxEvent" DROP COLUMN "skipReason";

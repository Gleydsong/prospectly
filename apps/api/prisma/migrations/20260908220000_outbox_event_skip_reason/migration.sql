-- Persist Omissão on PROCESSED OutboxEvent lines (no POST). Additive; existing rows stay NULL.

ALTER TABLE "OutboxEvent" ADD COLUMN "skipReason" TEXT;

-- Backfill durable SEARCHES usage from existing Search rows so deleting searches
-- cannot restore free quota or skip credit consumption for historical usage.
INSERT INTO "UsageLedger" ("id", "organizationId", "meterKey", "amount", "idempotencyKey", "createdAt")
SELECT
  s."id",
  s."organizationId",
  'SEARCHES',
  1,
  'search-usage:' || s."id",
  s."createdAt"
FROM "Search" s
ON CONFLICT ("organizationId", "idempotencyKey") DO NOTHING;

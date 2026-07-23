-- Durable dispatch state for reconciling PostgreSQL PENDING records with BullMQ.
ALTER TABLE "Search"
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "jobDispatchedAt" TIMESTAMP(3);

ALTER TABLE "Import"
  ADD COLUMN "stagedRows" JSONB,
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "jobDispatchedAt" TIMESTAMP(3);

CREATE INDEX "Search_status_jobDispatchedAt_idx" ON "Search"("status", "jobDispatchedAt");
CREATE INDEX "Import_status_jobDispatchedAt_idx" ON "Import"("status", "jobDispatchedAt");

-- Canonicalization helpers mirror the runtime normalization used by lead ingestion.
CREATE FUNCTION phase3_normalize_text(value TEXT) RETURNS TEXT
LANGUAGE SQL IMMUTABLE STRICT AS $$
  SELECT btrim(
    regexp_replace(
      translate(
        lower(btrim(value)),
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

CREATE FUNCTION phase3_normalize_phone(value TEXT) RETURNS TEXT
LANGUAGE SQL IMMUTABLE STRICT AS $$
  SELECT CASE
    WHEN regexp_replace(value, '[^0-9]', '', 'g') = '' THEN NULL
    WHEN length(regexp_replace(value, '[^0-9]', '', 'g')) IN (10, 11)
      THEN '+55' || regexp_replace(value, '[^0-9]', '', 'g')
    ELSE '+' || regexp_replace(value, '[^0-9]', '', 'g')
  END;
$$;

-- Detect equivalent legacy identities before any write. This is intentionally
-- non-destructive: operators receive the exact tenant/value/IDs to resolve.
DO $$
DECLARE
  conflict_record RECORD;
BEGIN
  SELECT conflict_type, organization_id, identity_value, lead_ids
  INTO conflict_record
  FROM (
    SELECT
      'domain' AS conflict_type,
      "organizationId" AS organization_id,
      lower(regexp_replace(btrim("domain"), '^www\.', '', 'i')) AS identity_value,
      array_agg("id" ORDER BY "createdAt", "id") AS lead_ids
    FROM "Lead"
    WHERE "domain" IS NOT NULL AND btrim("domain") <> ''
    GROUP BY "organizationId", lower(regexp_replace(btrim("domain"), '^www\.', '', 'i'))
    HAVING count(*) > 1

    UNION ALL

    SELECT
      'email' AS conflict_type,
      "organizationId" AS organization_id,
      lower(btrim("email")) AS identity_value,
      array_agg("id" ORDER BY "createdAt", "id") AS lead_ids
    FROM "Lead"
    WHERE "email" IS NOT NULL AND btrim("email") <> ''
    GROUP BY "organizationId", lower(btrim("email"))
    HAVING count(*) > 1

    UNION ALL

    SELECT
      'phone' AS conflict_type,
      "organizationId" AS organization_id,
      phase3_normalize_phone("phone") AS identity_value,
      array_agg("id" ORDER BY "createdAt", "id") AS lead_ids
    FROM "Lead"
    WHERE phase3_normalize_phone("phone") IS NOT NULL
    GROUP BY "organizationId", phase3_normalize_phone("phone")
    HAVING count(*) > 1
  ) AS canonical_conflicts
  ORDER BY conflict_type, organization_id, identity_value
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Phase 3 canonical identity migration blocked',
      DETAIL = format(
        'type=%s; organizationId=%s; canonicalValue=%s; leadIds=%s',
        conflict_record.conflict_type,
        conflict_record.organization_id,
        conflict_record.identity_value,
        conflict_record.lead_ids
      ),
      HINT = 'Resolve the listed legacy leads explicitly, then rerun this migration.';
  END IF;
END $$;

-- Detect probable collisions before adding/populating the new arbiter.
DO $$
DECLARE
  conflict_record RECORD;
BEGIN
  SELECT
    "organizationId" AS organization_id,
    phase3_normalize_text("companyName") || '|' || phase3_normalize_text("city") || '|' || upper(btrim("state")) AS fingerprint,
    array_agg("id" ORDER BY "createdAt", "id") AS lead_ids
  INTO conflict_record
  FROM "Lead"
  WHERE btrim("companyName") <> ''
    AND "city" IS NOT NULL AND btrim("city") <> ''
    AND "state" IS NOT NULL AND btrim("state") <> ''
  GROUP BY
    "organizationId",
    phase3_normalize_text("companyName") || '|' || phase3_normalize_text("city") || '|' || upper(btrim("state"))
  HAVING count(*) > 1
  ORDER BY organization_id, fingerprint
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Phase 3 probable duplicate migration blocked',
      DETAIL = format(
        'organizationId=%s; fingerprint=%s; leadIds=%s',
        conflict_record.organization_id,
        conflict_record.fingerprint,
        conflict_record.lead_ids
      ),
      HINT = 'Resolve the listed probable duplicates explicitly, then rerun this migration.';
  END IF;
END $$;

UPDATE "Lead"
SET
  "domain" = CASE
    WHEN "domain" IS NULL OR btrim("domain") = '' THEN NULL
    ELSE lower(regexp_replace(btrim("domain"), '^www\.', '', 'i'))
  END,
  "email" = CASE
    WHEN "email" IS NULL OR btrim("email") = '' THEN NULL
    ELSE lower(btrim("email"))
  END,
  "phone" = phase3_normalize_phone("phone");

ALTER TABLE "Lead" ADD COLUMN "probableDuplicateKey" TEXT;

UPDATE "Lead"
SET "probableDuplicateKey" =
  phase3_normalize_text("companyName") || '|' || phase3_normalize_text("city") || '|' || upper(btrim("state"))
WHERE btrim("companyName") <> ''
  AND "city" IS NOT NULL AND btrim("city") <> ''
  AND "state" IS NOT NULL AND btrim("state") <> '';

CREATE UNIQUE INDEX "Lead_organizationId_probableDuplicateKey_key"
  ON "Lead"("organizationId", "probableDuplicateKey");

DROP FUNCTION phase3_normalize_phone(TEXT);
DROP FUNCTION phase3_normalize_text(TEXT);

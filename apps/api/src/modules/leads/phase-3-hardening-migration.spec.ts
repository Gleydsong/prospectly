import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Phase 3 release hardening migration', () => {
  const sql = readFileSync(
    resolve(
      __dirname,
      '../../../prisma/migrations/20260722230000_phase_3_release_hardening/migration.sql',
    ),
    'utf8',
  );

  it('detects canonical legacy collisions before mutating identity columns', () => {
    const preflight = sql.indexOf('Phase 3 canonical identity migration blocked');
    const canonicalUpdate = sql.indexOf('UPDATE "Lead"');

    expect(preflight).toBeGreaterThan(-1);
    expect(canonicalUpdate).toBeGreaterThan(preflight);
    expect(sql).toContain('lower(btrim("email"))');
    expect(sql).toContain("regexp_replace(value, '[^0-9]', '', 'g')");
    expect(sql).toContain('phase3_normalize_phone("phone")');
  });

  it('preflights and persists probable fingerprints before adding the unique arbiter', () => {
    const probablePreflight = sql.indexOf('Phase 3 probable duplicate migration blocked');
    const addColumn = sql.indexOf('ADD COLUMN "probableDuplicateKey"');
    const uniqueIndex = sql.indexOf('Lead_organizationId_probableDuplicateKey_key');

    expect(probablePreflight).toBeGreaterThan(-1);
    expect(addColumn).toBeGreaterThan(probablePreflight);
    expect(uniqueIndex).toBeGreaterThan(addColumn);
  });
});

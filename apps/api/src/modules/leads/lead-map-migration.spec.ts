import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Lead map coordinate index migration', () => {
  it('adds the tenant and coordinate index without modifying saved clients', () => {
    const sql = readFileSync(
      resolve(
        __dirname,
        '../../../prisma/migrations/20261019130000_lead_map_coordinates/migration.sql',
      ),
      'utf8',
    );
    expect(sql).toMatch(
      /CREATE INDEX CONCURRENTLY "Lead_organizationId_latitude_longitude_idx"\s+ON "Lead"\("organizationId", "latitude", "longitude"\)/,
    );
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|ALTER)\b/);
  });
});

import {
  CANONICAL_API_ORIGIN,
  CANONICAL_APP_ORIGIN,
  CANONICAL_LANDING_ORIGIN,
  corsAllowlistAccepts,
  parseCorsOrigins,
} from './cors-origins';

describe('parseCorsOrigins', () => {
  it('splits, trims, and drops empties', () => {
    expect(
      parseCorsOrigins(` ${CANONICAL_APP_ORIGIN}, ${CANONICAL_LANDING_ORIGIN}, `),
    ).toEqual([CANONICAL_APP_ORIGIN, CANONICAL_LANDING_ORIGIN]);
  });

  it('accepts the canonical app origin on an explicit allowlist (no wildcard)', () => {
    const origins = parseCorsOrigins(
      `${CANONICAL_APP_ORIGIN},${CANONICAL_LANDING_ORIGIN},https://www.prospectlyonboard.com`,
    );
    expect(origins).not.toContain('*');
    expect(corsAllowlistAccepts(origins, CANONICAL_APP_ORIGIN)).toBe(true);
    expect(corsAllowlistAccepts(origins, CANONICAL_API_ORIGIN)).toBe(false);
  });
});

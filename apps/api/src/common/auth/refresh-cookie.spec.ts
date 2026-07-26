import {
  clearRefreshCookie,
  hasCsrfHeader,
  parseExpiresInToSeconds,
  readCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
} from './refresh-cookie';

describe('refresh-cookie helpers', () => {
  it('parses expiresIn durations', () => {
    expect(parseExpiresInToSeconds('15m')).toBe(900);
    expect(parseExpiresInToSeconds('7d')).toBe(7 * 24 * 60 * 60);
    expect(parseExpiresInToSeconds('bogus')).toBe(7 * 24 * 60 * 60);
  });

  it('reads cookie values from Cookie header', () => {
    const req = {
      headers: { cookie: `${REFRESH_COOKIE_NAME}=abc.def.ghi; other=1` },
    } as never;
    expect(readCookie(req, REFRESH_COOKIE_NAME)).toBe('abc.def.ghi');
  });

  it('requires CSRF header value', () => {
    expect(hasCsrfHeader({ headers: { 'x-requested-with': 'XMLHttpRequest' } } as never)).toBe(
      true,
    );
    expect(hasCsrfHeader({ headers: {} } as never)).toBe(false);
  });

  it('sets and clears refresh cookie options', () => {
    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const cleared: Array<{ name: string; options: Record<string, unknown> }> = [];
    const res = {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        cleared.push({ name, options });
      },
    } as never;

    setRefreshCookie(res, 'token-value', 3600, true);
    expect(cookies[0]).toMatchObject({
      name: REFRESH_COOKIE_NAME,
      value: 'token-value',
      options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/v1/auth' },
    });

    clearRefreshCookie(res, true);
    expect(cleared[0]?.name).toBe(REFRESH_COOKIE_NAME);
  });
});

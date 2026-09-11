import {
  clearRefreshCookie,
  hasCsrfHeader,
  parseExpiresInToSeconds,
  parseRefreshCookieSameSite,
  readCookie,
  REFRESH_COOKIE_NAME,
  resolveRefreshCookieSameSite,
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

    setRefreshCookie(res, 'token-value', 3600, false, 'lax');
    expect(cookies[0]).toMatchObject({
      name: REFRESH_COOKIE_NAME,
      value: 'token-value',
      options: { httpOnly: true, secure: false, sameSite: 'lax', path: '/api/v1/auth' },
    });

    setRefreshCookie(res, 'token-value', 3600, true, 'none');
    expect(cookies[1]).toMatchObject({
      options: { httpOnly: true, secure: true, sameSite: 'none', path: '/api/v1/auth' },
    });

    clearRefreshCookie(res, true, 'none');
    expect(cleared[0]).toEqual({
      name: REFRESH_COOKIE_NAME,
      options: { httpOnly: true, secure: true, sameSite: 'none', path: '/api/v1/auth' },
    });
  });

  it('defaults SameSite to none in production until cutover sets lax (app+api same site)', () => {
    expect(resolveRefreshCookieSameSite(undefined, 'production')).toBe('none');
    expect(resolveRefreshCookieSameSite(undefined, 'development')).toBe('lax');
    expect(resolveRefreshCookieSameSite('lax', 'production')).toBe('lax');
    expect(parseRefreshCookieSameSite('NONE')).toBe('none');
  });

  it('rejects SameSite=None without Secure', () => {
    expect(() => setRefreshCookie({ cookie: jest.fn() } as never, 'token', 60, false, 'none')).toThrow(
      'SameSite=None requires the Secure cookie attribute',
    );
  });
});

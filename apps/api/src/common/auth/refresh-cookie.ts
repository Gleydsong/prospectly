import type { CookieOptions, Request, Response } from 'express';

export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'XMLHttpRequest';

export type RefreshCookieSameSite = 'lax' | 'strict' | 'none';

export function parseExpiresInToSeconds(value: string | undefined): number {
  if (!value) return 7 * 24 * 60 * 60;
  const match = /^(\d+)([smhd])$/i.exec(value.trim());
  if (!match?.[1] || !match[2]) return 7 * 24 * 60 * 60;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * (multipliers[unit] ?? 86400);
}

export function parseRefreshCookieSameSite(value: unknown): RefreshCookieSameSite | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new Error('REFRESH_COOKIE_SAME_SITE must be lax, strict, or none');
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'lax' || normalized === 'strict' || normalized === 'none') {
    return normalized;
  }
  throw new Error('REFRESH_COOKIE_SAME_SITE must be lax, strict, or none');
}

export function resolveRefreshCookieSameSite(
  configured: unknown,
  nodeEnv: string,
): RefreshCookieSameSite {
  const parsed = parseRefreshCookieSameSite(configured);
  if (parsed) return parsed;
  return nodeEnv === 'production' || nodeEnv === 'staging' ? 'none' : 'lax';
}

export function refreshCookieOptions(
  maxAgeSeconds: number,
  secure: boolean,
  sameSite: RefreshCookieSameSite = 'lax',
): CookieOptions {
  if (sameSite === 'none' && !secure) {
    throw new Error('SameSite=None requires the Secure cookie attribute');
  }
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: REFRESH_COOKIE_PATH,
    maxAge: maxAgeSeconds * 1000,
  };
}

export function setRefreshCookie(
  res: Response,
  token: string,
  maxAgeSeconds: number,
  secure: boolean,
  sameSite: RefreshCookieSameSite = 'lax',
): void {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions(maxAgeSeconds, secure, sameSite));
}

export function clearRefreshCookie(
  res: Response,
  secure: boolean,
  sameSite: RefreshCookieSameSite = 'lax',
): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite,
    path: REFRESH_COOKIE_PATH,
  });
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const parts = header.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

export function hasCsrfHeader(req: Request): boolean {
  const value = req.headers[CSRF_HEADER];
  const header = Array.isArray(value) ? value[0] : value;
  return header === CSRF_HEADER_VALUE;
}

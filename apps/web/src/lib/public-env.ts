const DEV_API_FALLBACK = '/api/v1';
const DEV_LANDING_FALLBACK = 'http://localhost:3001';

function readTrimmedEnv(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Public API origin used by Axios.
 * Empty strings do not fall back — only an unset value in development uses `/api/v1`.
 * Production builds must set `VITE_API_URL` (enforced by `build:deploy`).
 */
export function resolvePublicApiUrl(): string {
  const value = readTrimmedEnv(import.meta.env.VITE_API_URL);
  if (value) return value.replace(/\/+$/, '');
  if (import.meta.env.PROD) {
    throw new Error('VITE_API_URL is required in production');
  }
  return DEV_API_FALLBACK;
}

/**
 * Marketing site origin for terms/privacy links.
 * Empty strings do not fall back to localhost in production.
 */
export function resolvePublicLandingUrl(): string {
  const value = readTrimmedEnv(import.meta.env.VITE_LANDING_URL);
  if (value) return value.replace(/\/+$/, '');
  if (import.meta.env.PROD) {
    throw new Error('VITE_LANDING_URL is required in production');
  }
  return DEV_LANDING_FALLBACK;
}

export function resolveGoogleClientId(): string | undefined {
  const value = readTrimmedEnv(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  return value.length > 0 ? value : undefined;
}

export function resolveSentryDsn(): string | undefined {
  const value = readTrimmedEnv(import.meta.env.VITE_SENTRY_DSN);
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return undefined;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.invalid')) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

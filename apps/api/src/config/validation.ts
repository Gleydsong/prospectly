import { parseRefreshCookieSameSite } from '../common/auth/refresh-cookie';
import { parseRedisConnection } from './redis';

const REQUIRED_VARS = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;

const WEAK_JWT_PATTERNS = [/change-me/i, /changeme/i, /secret-min-32/i, /your[_-]?secret/i, /example/i];

function assertStrongJwtSecret(key: string, value: string, nodeEnv: string): void {
  if (value.length < 32) {
    throw new Error(`${key} must have at least 32 characters`);
  }
  const isProdLike = nodeEnv === 'production' || nodeEnv === 'staging';
  if (!isProdLike) return;
  if (WEAK_JWT_PATTERNS.some((re) => re.test(value))) {
    throw new Error(`${key} looks like a placeholder and is not allowed in ${nodeEnv}`);
  }
  const unique = new Set(value).size;
  if (unique < 10) {
    throw new Error(`${key} has insufficient entropy for ${nodeEnv}`);
  }
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED_VARS.filter((key) => {
    const value = config[key];
    return typeof value !== 'string' || value.length === 0;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const nodeEnv =
    typeof config.NODE_ENV === 'string' ? config.NODE_ENV : process.env.NODE_ENV ?? 'development';

  const isProdLike = nodeEnv === 'production' || nodeEnv === 'staging';
  if (isProdLike) {
    const appUrl = config.DATABASE_APP_URL;
    if (typeof appUrl !== 'string' || appUrl.length === 0) {
      throw new Error('DATABASE_APP_URL is required in production (runtime role without BYPASSRLS)');
    }
  }

  const sameSite = parseRefreshCookieSameSite(config.REFRESH_COOKIE_SAME_SITE);
  if (sameSite === 'none' && !isProdLike) {
    throw new Error(
      'REFRESH_COOKIE_SAME_SITE=none requires NODE_ENV production or staging (Secure cookies)',
    );
  }

  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    const value = config[key];
    if (typeof value === 'string') {
      assertStrongJwtSecret(key, value, nodeEnv);
    }
  }

  const redisUrl = config.REDIS_URL;
  if (redisUrl !== undefined) {
    if (typeof redisUrl !== 'string') {
      throw new Error('REDIS_URL must be a valid Redis URL');
    }
    parseRedisConnection(redisUrl);
  }

  for (const key of ['OSM_NOMINATIM_URL', 'OSM_OVERPASS_URL'] as const) {
    const value = config[key];
    if (value === undefined) continue;

    if (typeof value !== 'string') {
      throw new Error(`${key} must be a valid URL`);
    }

    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');
    } catch {
      throw new Error(`${key} must be a valid URL`);
    }
  }

  const userAgent = config.OSM_USER_AGENT;
  if (userAgent !== undefined && (typeof userAgent !== 'string' || userAgent.trim().length === 0)) {
    throw new Error('OSM_USER_AGENT must not be empty');
  }

  for (const key of ['OSM_TIMEOUT_MS', 'OSM_RESULT_LIMIT', 'CSV_MAX_FILE_SIZE_BYTES', 'CSV_MAX_ROWS', 'GOOGLE_PLACES_TIMEOUT_MS', 'GOOGLE_PLACES_RESULT_LIMIT'] as const) {
    const value = config[key];
    if (value === undefined) continue;

    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error(`${key} must be a positive integer`);
    }
  }

  const googlePlacesBaseUrl = config.GOOGLE_PLACES_BASE_URL;
  if (googlePlacesBaseUrl !== undefined) {
    if (typeof googlePlacesBaseUrl !== 'string') {
      throw new Error('GOOGLE_PLACES_BASE_URL must be a valid URL');
    }
    try {
      const url = new URL(googlePlacesBaseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');
    } catch {
      throw new Error('GOOGLE_PLACES_BASE_URL must be a valid URL');
    }
  }

  for (const key of [
    'APPMAX_CLIENT_ID',
    'APPMAX_CLIENT_SECRET',
    'APPMAX_EXTERNAL_ID',
    'APPMAX_APP_ID',
    'APPMAX_SITE_ID',
    'APPMAX_MONTHLY_PRODUCT_ID',
    'APPMAX_AUTH_BASE_URL',
    'APPMAX_API_BASE_URL',
    'ABACATE_API_KEY',
    'ABACATE_WEBHOOK_SECRET',
    'ABACATE_WEBHOOK_HMAC_KEY',
    'ABACATE_SUCCESS_URL',
    'ABACATE_CANCEL_URL',
    'ABACATE_API_BASE_URL',
    'GOOGLE_CLIENT_ID',
  ] as const) {
    const value = config[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') {
      throw new Error(`${key} must be a string`);
    }
  }

  if (config.APPMAX_ENABLED !== undefined && !['true', 'false'].includes(String(config.APPMAX_ENABLED))) {
    throw new Error('APPMAX_ENABLED must be true or false');
  }

  if (isProdLike) {
    const requiredAbacate = [
      'ABACATE_API_KEY',
      'ABACATE_WEBHOOK_SECRET',
    ] as const;
    const missingAbacate = requiredAbacate.filter((key) => {
      const value = config[key];
      return typeof value !== 'string' || value.trim().length === 0;
    });
    if (missingAbacate.length > 0) {
      throw new Error(
        `Missing AbacatePay checkout configuration in ${nodeEnv}: ${missingAbacate.join(', ')}`,
      );
    }
  }

  if (String(config.APPMAX_ENABLED) === 'true') {
    const requiredAppmax = [
      'APPMAX_CLIENT_ID',
      'APPMAX_CLIENT_SECRET',
      'APPMAX_EXTERNAL_ID',
      'APPMAX_APP_ID',
      'APPMAX_SITE_ID',
      'APPMAX_MONTHLY_PRODUCT_ID',
    ] as const;
    const missingAppmax = requiredAppmax.filter((key) => {
      const value = config[key];
      return typeof value !== 'string' || value.trim().length === 0;
    });
    if (missingAppmax.length > 0) {
      throw new Error(
        `Missing Appmax card configuration: ${missingAppmax.join(', ')}`,
      );
    }
  }

  const lifetimeAmount = config.ABACATE_LIFETIME_AMOUNT_CENTAVOS;
  if (lifetimeAmount !== undefined) {
    const parsed =
      typeof lifetimeAmount === 'number' ? lifetimeAmount : Number(lifetimeAmount);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('ABACATE_LIFETIME_AMOUNT_CENTAVOS must be a positive integer');
    }
  }

  const monthlyAmount = config.ABACATE_MONTHLY_AMOUNT_CENTAVOS;
  if (monthlyAmount !== undefined) {
    const parsed =
      typeof monthlyAmount === 'number' ? monthlyAmount : Number(monthlyAmount);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('ABACATE_MONTHLY_AMOUNT_CENTAVOS must be a positive integer');
    }
  }

  const httpTimeout = config.ABACATE_HTTP_TIMEOUT_MS;
  if (httpTimeout !== undefined) {
    const parsed = typeof httpTimeout === 'number' ? httpTimeout : Number(httpTimeout);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('ABACATE_HTTP_TIMEOUT_MS must be a positive integer');
    }
  }

  for (const key of ['APPMAX_HTTP_TIMEOUT_MS', 'APPMAX_RECONCILE_INTERVAL_MS'] as const) {
    const value = config[key];
    if (value === undefined) continue;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error(`${key} must be a positive integer`);
    }
  }

  return config;
}

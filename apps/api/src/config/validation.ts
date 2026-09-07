import { parseRefreshCookieSameSite } from '../common/auth/refresh-cookie';
import { parseProcessRole } from './process-role';
import { parseRedisConnection } from './redis';

const API_REQUIRED_VARS = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;
const WORKER_REQUIRED_VARS = ['DATABASE_URL', 'REDIS_URL'] as const;

const WEAK_JWT_PATTERNS = [
  /change-me/i,
  /changeme/i,
  /secret-min-32/i,
  /your[_-]?secret/i,
  /example/i,
];

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
  const role = parseProcessRole(config);
  const requiredVars = role === 'worker' ? WORKER_REQUIRED_VARS : API_REQUIRED_VARS;
  const missing = requiredVars.filter((key) => {
    const value = config[key];
    return typeof value !== 'string' || value.length === 0;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const nodeEnv =
    typeof config.NODE_ENV === 'string' ? config.NODE_ENV : (process.env.NODE_ENV ?? 'development');

  const isProdLike = nodeEnv === 'production' || nodeEnv === 'staging';
  if (isProdLike) {
    const appUrl = config.DATABASE_APP_URL;
    if (typeof appUrl !== 'string' || appUrl.length === 0) {
      throw new Error(
        'DATABASE_APP_URL is required in production (runtime role without BYPASSRLS)',
      );
    }
  }

  if (role === 'api') {
    const sameSite = parseRefreshCookieSameSite(config.REFRESH_COOKIE_SAME_SITE);
    if (sameSite === 'none' && !isProdLike) {
      throw new Error(
        'REFRESH_COOKIE_SAME_SITE=none requires NODE_ENV production or staging (Secure cookies)',
      );
    }
  }

  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    const value = config[key];
    if (typeof value === 'string') {
      assertStrongJwtSecret(key, value, nodeEnv);
    }
  }

  const opsMetricsToken = config.OPS_METRICS_TOKEN;
  if (opsMetricsToken !== undefined && opsMetricsToken !== '') {
    if (typeof opsMetricsToken !== 'string' || opsMetricsToken.length < 32) {
      throw new Error('OPS_METRICS_TOKEN must have at least 32 characters');
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

  for (const key of [
    'OSM_TIMEOUT_MS',
    'OSM_RESULT_LIMIT',
    'CSV_MAX_FILE_SIZE_BYTES',
    'CSV_MAX_ROWS',
    'GOOGLE_PLACES_TIMEOUT_MS',
    'GOOGLE_PLACES_RESULT_LIMIT',
  ] as const) {
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
    'ABACATE_API_KEY',
    'ABACATE_WEBHOOK_SECRET',
    'ABACATE_WEBHOOK_HMAC_KEY',
    'ABACATE_SUCCESS_URL',
    'ABACATE_CANCEL_URL',
    'ABACATE_API_BASE_URL',
    'PIX_PROVIDER',
    'ASAAS_ENABLED',
    'ASAAS_API_KEY',
    'ASAAS_WEBHOOK_TOKEN',
    'ASAAS_API_BASE_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_OAUTH_REDIRECT_URI',
    'GOOGLE_TOKEN_ENCRYPTION_KEY',
  ] as const) {
    const value = config[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') {
      throw new Error(`${key} must be a string`);
    }
  }

  const tokenKey = config.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (typeof tokenKey === 'string' && tokenKey.trim().length > 0) {
    if (!/^[0-9a-fA-F]{64}$/.test(tokenKey.trim())) {
      throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }
  }

  if (
    config.ASAAS_ENABLED !== undefined &&
    config.ASAAS_ENABLED !== 'true' &&
    config.ASAAS_ENABLED !== 'false'
  ) {
    throw new Error('ASAAS_ENABLED must be true or false');
  }

  if (
    config.PIX_PROVIDER !== undefined &&
    config.PIX_PROVIDER !== 'ABACATE' &&
    config.PIX_PROVIDER !== 'ASAAS' &&
    config.PIX_PROVIDER !== 'DISABLED'
  ) {
    throw new Error('PIX_PROVIDER must be ABACATE, ASAAS or DISABLED');
  }

  if (role === 'api' && config.PIX_PROVIDER === 'ASAAS' && config.ASAAS_ENABLED !== 'true') {
    throw new Error('PIX_PROVIDER=ASAAS requires ASAAS_ENABLED=true');
  }

  if (role === 'api' && config.ASAAS_ENABLED === 'true') {
    const requiredAsaas = ['ASAAS_API_KEY', 'ASAAS_WEBHOOK_TOKEN'] as const;
    const missingAsaas = requiredAsaas.filter((key) => {
      const value = config[key];
      return typeof value !== 'string' || value.trim().length === 0;
    });
    if (missingAsaas.length > 0) {
      throw new Error(`Missing Asaas configuration: ${missingAsaas.join(', ')}`);
    }
    const asaasApiKey = config.ASAAS_API_KEY;
    const asaasApiBaseUrl = config.ASAAS_API_BASE_URL;
    if (typeof asaasApiKey === 'string') {
      assertAsaasApiEnvironment(
        asaasApiKey,
        typeof asaasApiBaseUrl === 'string' ? asaasApiBaseUrl : undefined,
      );
    }
  }

  if (isProdLike && role === 'api') {
    const requiredAbacate = ['ABACATE_API_KEY', 'ABACATE_WEBHOOK_SECRET'] as const;
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

  const lifetimeAmount = config.ABACATE_LIFETIME_AMOUNT_CENTAVOS;
  if (lifetimeAmount !== undefined) {
    const parsed = typeof lifetimeAmount === 'number' ? lifetimeAmount : Number(lifetimeAmount);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('ABACATE_LIFETIME_AMOUNT_CENTAVOS must be a positive integer');
    }
  }

  const monthlyAmount = config.ABACATE_MONTHLY_AMOUNT_CENTAVOS;
  if (monthlyAmount !== undefined) {
    const parsed = typeof monthlyAmount === 'number' ? monthlyAmount : Number(monthlyAmount);
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

  const asaasHttpTimeout = config.ASAAS_HTTP_TIMEOUT_MS;
  if (asaasHttpTimeout !== undefined) {
    const parsed =
      typeof asaasHttpTimeout === 'number' ? asaasHttpTimeout : Number(asaasHttpTimeout);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('ASAAS_HTTP_TIMEOUT_MS must be a positive integer');
    }
  }

  return config;
}

function assertAsaasApiEnvironment(apiKey: string, apiBaseUrl: string | undefined): void {
  const url = (apiBaseUrl ?? 'https://api-sandbox.asaas.com/v3').toLowerCase();
  const isSandboxUrl = url.includes('sandbox');
  const isProductionUrl = url.includes('api.asaas.com') && !isSandboxUrl;
  const isProductionKey = apiKey.includes('$aact_prod_') || /(?:^|_)prod(?:_|$)/.test(apiKey);
  const isSandboxKey = apiKey.includes('$aact_hmlg_') || /(?:^|_)hmlg(?:_|$)/.test(apiKey);
  if (isProductionKey && isSandboxUrl) {
    throw new Error('ASAAS_API_KEY is a production key but ASAAS_API_BASE_URL points to sandbox');
  }
  if (isSandboxKey && isProductionUrl) {
    throw new Error('ASAAS_API_KEY is a sandbox key but ASAAS_API_BASE_URL points to production');
  }
}

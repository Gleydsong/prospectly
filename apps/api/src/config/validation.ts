const REQUIRED_VARS = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED_VARS.filter((key) => {
    const value = config[key];
    return typeof value !== 'string' || value.length === 0;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    const value = config[key];
    if (typeof value === 'string' && value.length < 16) {
      throw new Error(`${key} must have at least 16 characters`);
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

  for (const key of ['OSM_TIMEOUT_MS', 'OSM_RESULT_LIMIT', 'CSV_MAX_FILE_SIZE_BYTES', 'CSV_MAX_ROWS'] as const) {
    const value = config[key];
    if (value === undefined) continue;

    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error(`${key} must be a positive integer`);
    }
  }

  return config;
}
import { parseRedisConnection } from './redis';

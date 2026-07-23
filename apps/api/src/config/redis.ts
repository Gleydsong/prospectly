export interface RedisConnectionConfig {
  host: string;
  port: number;
  db: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
}

export function parseRedisConnection(redisUrl: string): RedisConnectionConfig {
  let url: URL;
  try {
    url = new URL(redisUrl);
  } catch {
    throw new Error('REDIS_URL must be a valid Redis URL');
  }

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use redis:// or rediss://');
  }
  if (!url.hostname) {
    throw new Error('REDIS_URL must include a host');
  }
  if (!/^\/(?:0|[1-9]\d*)?$/.test(url.pathname || '/')) {
    throw new Error('REDIS_URL database must be a non-negative integer');
  }

  const db = Number((url.pathname || '/').slice(1) || '0');
  const port = Number(url.port || '6379');
  if (!Number.isSafeInteger(db) || db < 0) {
    throw new Error('REDIS_URL database must be a non-negative integer');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('REDIS_URL port must be between 1 and 65535');
  }

  return {
    host: url.hostname,
    port,
    db,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

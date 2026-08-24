import { parseRedisConnection } from './redis';
import { validateEnv } from './validation';

const baseConfig = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/prospectly',
  JWT_ACCESS_SECRET: 'a-very-long-access-secret-32chars!',
  JWT_REFRESH_SECRET: 'a-very-long-refresh-secret-32chars',
};

describe('Redis configuration', () => {
  it('parses credentials, database and TLS from a rediss URL for BullMQ', () => {
    expect(parseRedisConnection('rediss://queue-user:p%40ssword@redis.example:6380/2')).toEqual({
      host: 'redis.example',
      port: 6380,
      username: 'queue-user',
      password: 'p@ssword',
      db: 2,
      tls: {},
    });
  });

  it.each([
    'https://redis.example:6379/0',
    'redis://redis.example/not-a-database',
    'redis://redis.example/1/2',
  ])('rejects an invalid REDIS_URL: %s', (redisUrl) => {
    expect(() => validateEnv({ ...baseConfig, REDIS_URL: redisUrl })).toThrow('REDIS_URL');
  });

  it('requires DATABASE_APP_URL in production', () => {
    expect(() => validateEnv({ ...baseConfig, NODE_ENV: 'production' })).toThrow(
      'DATABASE_APP_URL',
    );
    expect(() =>
      validateEnv({
        ...baseConfig,
        NODE_ENV: 'production',
        DATABASE_APP_URL: 'postgresql://prospectly_app:secret@localhost:5432/prospectly',
        ABACATE_API_KEY: 'ak_test',
        ABACATE_WEBHOOK_SECRET: 'whsec_test',
        ABACATE_SUCCESS_URL: 'https://app.example/billing/success',
        ABACATE_CANCEL_URL: 'https://app.example/billing/cancel',
      }),
    ).not.toThrow();
  });

  it('rejects SameSite=None outside production-like environments', () => {
    expect(() => validateEnv({ ...baseConfig, REFRESH_COOKIE_SAME_SITE: 'none' })).toThrow(
      'REFRESH_COOKIE_SAME_SITE=none',
    );
    expect(() =>
      validateEnv({
        ...baseConfig,
        NODE_ENV: 'production',
        DATABASE_APP_URL: 'postgresql://prospectly_app:secret@localhost:5432/prospectly',
        REFRESH_COOKIE_SAME_SITE: 'none',
        ABACATE_API_KEY: 'ak_test',
        ABACATE_WEBHOOK_SECRET: 'whsec_test',
        ABACATE_SUCCESS_URL: 'https://app.example/billing/success',
        ABACATE_CANCEL_URL: 'https://app.example/billing/cancel',
      }),
    ).not.toThrow();
  });

  it('allows production without AbacatePay catalog product ids', () => {
    expect(() =>
      validateEnv({
        ...baseConfig,
        NODE_ENV: 'production',
        DATABASE_APP_URL: 'postgresql://prospectly_app:secret@localhost:5432/prospectly',
        ABACATE_API_KEY: 'ak_test',
        ABACATE_WEBHOOK_SECRET: 'whsec_test',
        ABACATE_SUCCESS_URL: 'https://app.example/billing/success',
        ABACATE_CANCEL_URL: 'https://app.example/billing/cancel',
      }),
    ).not.toThrow();
  });
});

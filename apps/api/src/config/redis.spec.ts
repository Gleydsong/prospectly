import { parseRedisConnection } from './redis';
import { validateEnv } from './validation';

const baseConfig = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/prospectly',
  JWT_ACCESS_SECRET: 'a-very-long-access-secret',
  JWT_REFRESH_SECRET: 'a-very-long-refresh-secret',
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
});

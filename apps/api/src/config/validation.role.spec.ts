import { validateEnv } from './validation';

const apiConfig = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/prospectly',
  JWT_ACCESS_SECRET: 'a-very-long-access-secret-32chars!',
  JWT_REFRESH_SECRET: 'a-very-long-refresh-secret-32chars',
};

const workerProdConfig = {
  ROLE: 'worker',
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://owner:secret@localhost:5432/prospectly',
  DATABASE_APP_URL: 'postgresql://prospectly_app:secret@localhost:5432/prospectly',
  REDIS_URL: 'redis://localhost:6379',
};

describe('role-aware environment validation', () => {
  it('does not require JWT or billing secrets for ROLE=worker in production', () => {
    expect(() => validateEnv(workerProdConfig)).not.toThrow();
  });

  it('still requires JWT secrets for the API role in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: workerProdConfig.DATABASE_URL,
        DATABASE_APP_URL: workerProdConfig.DATABASE_APP_URL,
      }),
    ).toThrow('Missing required environment variables: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET');
  });

  it('requires REDIS_URL for ROLE=worker', () => {
    const { REDIS_URL: _omit, ...withoutRedis } = workerProdConfig;
    expect(() => validateEnv(withoutRedis)).toThrow('Missing required environment variables: REDIS_URL');
  });

  it('requires DATABASE_APP_URL for ROLE=worker in production', () => {
    const { DATABASE_APP_URL: _omit, ...withoutAppUrl } = workerProdConfig;
    expect(() => validateEnv(withoutAppUrl)).toThrow('DATABASE_APP_URL');
  });

  it('does not require AbacatePay for the API role in production', () => {
    expect(() =>
      validateEnv({
        ...apiConfig,
        NODE_ENV: 'production',
        DATABASE_APP_URL: workerProdConfig.DATABASE_APP_URL,
      }),
    ).not.toThrow();
  });
});

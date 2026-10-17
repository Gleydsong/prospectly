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
  it.each(['api', 'worker'])('%s starts in production without the owner URL', (role) => {
    const { DATABASE_URL: _owner, ...runtimeConfig } = workerProdConfig;
    expect(() =>
      validateEnv({ ...apiConfig, ...runtimeConfig, DATABASE_URL: undefined, ROLE: role }),
    ).not.toThrow();
  });

  it.each(['api', 'worker'])('%s rejects owner fallback in production and staging', (role) => {
    for (const nodeEnv of ['production', 'staging']) {
      for (const appUrl of [undefined, '', '   ']) {
        expect(() =>
          validateEnv({
            ...apiConfig,
            ...workerProdConfig,
            ROLE: role,
            NODE_ENV: nodeEnv,
            DATABASE_APP_URL: appUrl,
          }),
        ).toThrow('DATABASE_APP_URL');
      }
    }
  });

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
    expect(() => validateEnv(withoutRedis)).toThrow(
      'Missing required environment variables: REDIS_URL',
    );
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

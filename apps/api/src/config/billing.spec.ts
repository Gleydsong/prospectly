import { validateEnv } from './validation';

const baseConfig = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/prospectly',
  JWT_ACCESS_SECRET: 'a-very-long-access-secret-32chars!',
  JWT_REFRESH_SECRET: 'a-very-long-refresh-secret-32chars',
};

describe('Billing environment configuration', () => {
  it.each(['ASAAS', 'DISABLED'])('accepts PIX_PROVIDER=%s', (pixProvider) => {
    expect(() =>
      validateEnv({
        ...baseConfig,
        PIX_PROVIDER: pixProvider,
        ...(pixProvider === 'ASAAS'
          ? {
              ASAAS_ENABLED: 'true',
              ASAAS_API_KEY: 'asaas_test_key',
              ASAAS_WEBHOOK_TOKEN: 'a-secure-webhook-token-with-32-chars',
            }
          : {}),
      }),
    ).not.toThrow();
  });

  it('rejects unknown PIX providers', () => {
    expect(() => validateEnv({ ...baseConfig, PIX_PROVIDER: 'AUTO' })).toThrow(
      'PIX_PROVIDER must be ASAAS or DISABLED',
    );
    expect(() => validateEnv({ ...baseConfig, PIX_PROVIDER: 'ABACATE' })).toThrow(
      'PIX_PROVIDER must be ASAAS or DISABLED',
    );
  });

  it('treats missing ASAAS_ENABLED as disabled and does not require Asaas secrets', () => {
    expect(() => validateEnv({ ...baseConfig })).not.toThrow();
  });

  it('requires Asaas to be enabled when PIX routes to Asaas', () => {
    expect(() =>
      validateEnv({ ...baseConfig, PIX_PROVIDER: 'ASAAS', ASAAS_ENABLED: 'false' }),
    ).toThrow('PIX_PROVIDER=ASAAS requires ASAAS_ENABLED=true');
  });

  it('rejects the Asaas PIX cutover flags without secrets', () => {
    expect(() =>
      validateEnv({ ...baseConfig, PIX_PROVIDER: 'ASAAS', ASAAS_ENABLED: 'true' }),
    ).toThrow('Missing Asaas configuration: ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN');
  });

  it('rejects a production Asaas key pointed at the sandbox API', () => {
    expect(() =>
      validateEnv({
        ...baseConfig,
        ASAAS_ENABLED: 'true',
        ASAAS_API_KEY: '$aact_prod_Y2xhcmU=',
        ASAAS_WEBHOOK_TOKEN: 'a-secure-webhook-token-with-32-chars',
        ASAAS_API_BASE_URL: 'https://api-sandbox.asaas.com/v3',
      }),
    ).toThrow('ASAAS_API_KEY is a production key but ASAAS_API_BASE_URL points to sandbox');
  });

  it('rejects a sandbox Asaas key pointed at the production API', () => {
    expect(() =>
      validateEnv({
        ...baseConfig,
        ASAAS_ENABLED: 'true',
        ASAAS_API_KEY: '$aact_hmlg_Y2xhcmU=',
        ASAAS_WEBHOOK_TOKEN: 'a-secure-webhook-token-with-32-chars',
        ASAAS_API_BASE_URL: 'https://api.asaas.com/v3',
      }),
    ).toThrow('ASAAS_API_KEY is a sandbox key but ASAAS_API_BASE_URL points to production');
  });
});

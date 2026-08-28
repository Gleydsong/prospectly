import { validateEnv } from './validation';

const baseConfig = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/prospectly',
  JWT_ACCESS_SECRET: 'a-very-long-access-secret-32chars!',
  JWT_REFRESH_SECRET: 'a-very-long-refresh-secret-32chars',
};

describe('Billing environment configuration', () => {
  it.each(['ABACATE', 'ASAAS', 'DISABLED'])('accepts PIX_PROVIDER=%s', (pixProvider) => {
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
      'PIX_PROVIDER must be ABACATE, ASAAS or DISABLED',
    );
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
});

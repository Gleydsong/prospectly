import { PINO_REDACT_PATHS } from './pino-redact-paths';

describe('PINO_REDACT_PATHS', () => {
  const joined = PINO_REDACT_PATHS.join('\n');

  it('redacts credentials, tokens and Brazilian taxpayer ids', () => {
    expect(joined).toMatch(/password/i);
    expect(joined).toMatch(/refreshToken/);
    expect(joined).toMatch(/authorization/);
    expect(joined).toMatch(/cpfCnpj/);
    expect(joined).toMatch(/cookie/);
  });

  it('does not leave webhook secrets in query strings', () => {
    expect(PINO_REDACT_PATHS).toContain('req.query.webhookSecret');
    expect(PINO_REDACT_PATHS).toContain('req.query.token');
  });
});

import { configuration } from './configuration';
import { validateEnv } from './validation';

const baseValidConfig = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/prospectly',
  JWT_ACCESS_SECRET: 'a-very-long-access-secret-32chars!',
  JWT_REFRESH_SECRET: 'a-very-long-refresh-secret-32chars',
};

const prodConfig = {
  NODE_ENV: 'production',
  DATABASE_APP_URL: 'postgresql://prospectly_app:secret@localhost:5432/prospectly',
  JWT_ACCESS_SECRET: 'a-very-long-access-secret-32chars!',
  JWT_REFRESH_SECRET: 'a-very-long-refresh-secret-32chars',
};

describe('AI provider environment validation', () => {
  describe('provider and fallback values', () => {
    it.each(['cloudflare', 'groq', 'disabled', 'CLOUDFLARE', 'GROQ', 'DISABLED'])(
      'accepts valid AI_PROVIDER %s',
      (provider) => {
        expect(() =>
          validateEnv({
            ...baseValidConfig,
            AI_PROVIDER: provider,
          }),
        ).not.toThrow();
      },
    );

    it('rejects invalid AI_PROVIDER value', () => {
      expect(() =>
        validateEnv({
          ...baseValidConfig,
          AI_PROVIDER: 'unsupported-provider',
        }),
      ).toThrow('AI_PROVIDER must be cloudflare, groq, or disabled');
    });

    it.each(['groq', 'none', 'disabled', 'GROQ', 'NONE'])(
      'accepts valid AI_FALLBACK_PROVIDER %s',
      (fallback) => {
        expect(() =>
          validateEnv({
            ...baseValidConfig,
            AI_FALLBACK_PROVIDER: fallback,
          }),
        ).not.toThrow();
      },
    );

    it('rejects invalid AI_FALLBACK_PROVIDER value', () => {
      expect(() =>
        validateEnv({
          ...baseValidConfig,
          AI_FALLBACK_PROVIDER: 'openai',
        }),
      ).toThrow('AI_FALLBACK_PROVIDER must be groq, none, or disabled');
    });
  });

  describe('numeric parameters', () => {
    it('accepts valid timeouts, retries and budgets', () => {
      expect(() =>
        validateEnv({
          ...baseValidConfig,
          AI_TIMEOUT_MS: '25000',
          AI_MAX_RETRIES: '3',
          AI_DAILY_BUDGET_TOKENS: '50000',
        }),
      ).not.toThrow();
    });

    it('rejects negative or non-integer AI_TIMEOUT_MS', () => {
      expect(() =>
        validateEnv({
          ...baseValidConfig,
          AI_TIMEOUT_MS: '-100',
        }),
      ).toThrow('AI_TIMEOUT_MS must be a positive integer');
    });

    it('rejects negative AI_MAX_RETRIES', () => {
      expect(() =>
        validateEnv({
          ...baseValidConfig,
          AI_MAX_RETRIES: '-1',
        }),
      ).toThrow('AI_MAX_RETRIES must be a non-negative integer');
    });

    it('rejects empty string AI_MAX_RETRIES', () => {
      expect(() =>
        validateEnv({
          ...baseValidConfig,
          AI_MAX_RETRIES: '',
        }),
      ).toThrow('AI_MAX_RETRIES must be a non-negative integer');
    });

    it('rejects empty string or invalid AI_STREAM_IDLE_TIMEOUT_MS', () => {
      expect(() =>
        validateEnv({
          ...baseValidConfig,
          AI_STREAM_IDLE_TIMEOUT_MS: '',
        }),
      ).toThrow('AI_STREAM_IDLE_TIMEOUT_MS must be a positive integer');

      expect(() =>
        validateEnv({
          ...baseValidConfig,
          AI_STREAM_IDLE_TIMEOUT_MS: '-10',
        }),
      ).toThrow('AI_STREAM_IDLE_TIMEOUT_MS must be a positive integer');
    });

    it('rejects zero or negative AI_DAILY_BUDGET_TOKENS', () => {
      expect(() =>
        validateEnv({
          ...baseValidConfig,
          AI_DAILY_BUDGET_TOKENS: '0',
        }),
      ).toThrow('AI_DAILY_BUDGET_TOKENS must be a positive integer');
    });
  });

  describe('production boot requirements', () => {
    it('allows AI_PROVIDER=disabled in production without tokens', () => {
      expect(() =>
        validateEnv({
          ...prodConfig,
          AI_PROVIDER: 'disabled',
        }),
      ).not.toThrow();
    });

    it('fails production boot when AI_PROVIDER is cloudflare without account ID', () => {
      expect(() =>
        validateEnv({
          ...prodConfig,
          AI_PROVIDER: 'cloudflare',
          CLOUDFLARE_ACCOUNT_ID: '',
          CLOUDFLARE_AI_TOKEN: 'cf-secret-token',
        }),
      ).toThrow('CLOUDFLARE_ACCOUNT_ID is required in production when AI_PROVIDER is cloudflare');
    });

    it('fails production boot when AI_PROVIDER is cloudflare without AI token', () => {
      expect(() =>
        validateEnv({
          ...prodConfig,
          AI_PROVIDER: 'cloudflare',
          CLOUDFLARE_ACCOUNT_ID: 'cf-account-id',
          CLOUDFLARE_AI_TOKEN: '',
        }),
      ).toThrow('CLOUDFLARE_AI_TOKEN is required in production when AI_PROVIDER is cloudflare');
    });

    it('passes production boot when AI_PROVIDER is cloudflare with valid credentials', () => {
      expect(() =>
        validateEnv({
          ...prodConfig,
          AI_PROVIDER: 'cloudflare',
          CLOUDFLARE_ACCOUNT_ID: 'cf-account-id',
          CLOUDFLARE_AI_TOKEN: 'cf-token',
        }),
      ).not.toThrow();
    });

    it('fails production boot when AI_PROVIDER is groq without API key', () => {
      expect(() =>
        validateEnv({
          ...prodConfig,
          AI_PROVIDER: 'groq',
          GROQ_API_KEY: '',
        }),
      ).toThrow('GROQ_API_KEY is required in production when AI_PROVIDER is groq');
    });

    it('passes production boot when AI_PROVIDER is groq with API key', () => {
      expect(() =>
        validateEnv({
          ...prodConfig,
          AI_PROVIDER: 'groq',
          GROQ_API_KEY: 'gsk-secret-key',
        }),
      ).not.toThrow();
    });

    it('fails production boot when fallback is groq but GROQ_API_KEY is missing', () => {
      expect(() =>
        validateEnv({
          ...prodConfig,
          AI_PROVIDER: 'cloudflare',
          CLOUDFLARE_ACCOUNT_ID: 'cf-account-id',
          CLOUDFLARE_AI_TOKEN: 'cf-token',
          AI_FALLBACK_PROVIDER: 'groq',
          GROQ_API_KEY: '',
        }),
      ).toThrow('GROQ_API_KEY is required in production when AI_FALLBACK_PROVIDER is groq');
    });
  });
});

describe('AI provider configuration normalization', () => {
  it('uses the Groq default model for a whitespace-padded provider accepted by validation', () => {
    const previousProvider = process.env.AI_PROVIDER;
    const previousModel = process.env.AI_MODEL;
    const previousFallback = process.env.AI_FALLBACK_PROVIDER;
    try {
      process.env.AI_PROVIDER = ' groq ';
      process.env.AI_FALLBACK_PROVIDER = ' groq ';
      delete process.env.AI_MODEL;
      expect(() =>
        validateEnv({ ...baseValidConfig, AI_PROVIDER: process.env.AI_PROVIDER }),
      ).not.toThrow();
      expect(configuration().ai).toEqual(
        expect.objectContaining({
          provider: 'groq',
          model: 'openai/gpt-oss-120b',
          fallbackProvider: 'groq',
        }),
      );
    } finally {
      if (previousProvider === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = previousProvider;
      if (previousModel === undefined) delete process.env.AI_MODEL;
      else process.env.AI_MODEL = previousModel;
      if (previousFallback === undefined) delete process.env.AI_FALLBACK_PROVIDER;
      else process.env.AI_FALLBACK_PROVIDER = previousFallback;
    }
  });

  it('normalizes empty string AI_MAX_RETRIES to default 2 rather than NaN', () => {
    const previousRetries = process.env.AI_MAX_RETRIES;
    try {
      process.env.AI_MAX_RETRIES = '';
      expect(configuration().ai.maxRetries).toBe(2);
    } finally {
      if (previousRetries === undefined) delete process.env.AI_MAX_RETRIES;
      else process.env.AI_MAX_RETRIES = previousRetries;
    }
  });

  it('normalizes empty string or undefined AI_STREAM_IDLE_TIMEOUT_MS to default', () => {
    const previousIdle = process.env.AI_STREAM_IDLE_TIMEOUT_MS;
    try {
      delete process.env.AI_STREAM_IDLE_TIMEOUT_MS;
      expect(configuration().ai.streamIdleTimeoutMs).toBe(30000);
      process.env.AI_STREAM_IDLE_TIMEOUT_MS = '';
      expect(configuration().ai.streamIdleTimeoutMs).toBe(30000);
    } finally {
      if (previousIdle === undefined) delete process.env.AI_STREAM_IDLE_TIMEOUT_MS;
      else process.env.AI_STREAM_IDLE_TIMEOUT_MS = previousIdle;
    }
  });
});

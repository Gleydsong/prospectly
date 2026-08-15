import { beforeEach, describe, expect, it, vi } from 'vitest';

const init = vi.fn();
const captureException = vi.fn();

vi.mock('@sentry/react', () => ({
  init,
  captureException,
}));

describe('observability', () => {
  beforeEach(() => {
    vi.resetModules();
    init.mockReset();
    captureException.mockReset();
    vi.unstubAllEnvs();
  });

  it('does not load Sentry when the DSN is absent', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '');
    const { initObservability, captureClientError } = await import('./observability');
    initObservability();
    captureClientError(new Error('no-op'));
    await Promise.resolve();
    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('initializes Sentry and captures errors when the DSN is valid', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@o1.ingest.sentry.io/1');
    const { initObservability, captureClientError } = await import('./observability');
    initObservability();
    await vi.waitFor(() => expect(init).toHaveBeenCalledTimes(1));
    expect(init.mock.calls[0]?.[0]).toMatchObject({
      environment: expect.any(String),
      release: 'prospectly-web@0.1.0',
      sendDefaultPii: false,
    });
    expect(JSON.stringify(init.mock.calls[0]?.[0])).not.toMatch(/Authorization|secret/i);

    captureClientError(new Error('controlled'), { accessToken: 'tok', correlationId: 'c1' });
    await vi.waitFor(() => expect(captureException).toHaveBeenCalled());
    const extra = captureException.mock.calls[0]?.[1];
    expect(JSON.stringify(extra)).not.toContain('tok');
    expect(JSON.stringify(extra)).toContain('c1');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: apiMocks,
  AUTH_REQUEST_TIMEOUT_MS: 60_000,
}));

import { login, register } from './api';

describe('auth API timeouts', () => {
  beforeEach(() => {
    apiMocks.post.mockReset();
    apiMocks.post.mockResolvedValue({ data: {} });
  });

  it('allows login enough time for the production API to become ready', async () => {
    const input = { email: 'demo@prospectly.dev', password: 'secret1' };

    await login(input);

    expect(apiMocks.post).toHaveBeenCalledWith('/auth/login', input, { timeout: 60_000 });
  });

  it('uses the same extended timeout for registration', async () => {
    const input = {
      name: 'Demo User',
      email: 'demo@prospectly.dev',
      password: 'secret1',
      organizationName: 'Demo Organization',
      locale: 'pt' as const,
      acceptTerms: true as const,
    };

    await register(input);

    expect(apiMocks.post).toHaveBeenCalledWith('/auth/register', input, { timeout: 60_000 });
  });
});

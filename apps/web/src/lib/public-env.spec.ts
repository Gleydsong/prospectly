import { describe, expect, it, vi } from 'vitest';

import { resolvePublicApiUrl, resolvePublicLandingUrl } from './public-env';

describe('resolvePublicApiUrl', () => {
  it('trims configured values and ignores empty strings', () => {
    vi.stubEnv('VITE_API_URL', '  https://api.example.com/api/v1  ');
    expect(resolvePublicApiUrl()).toBe('https://api.example.com/api/v1');
    vi.stubEnv('VITE_API_URL', '   ');
    expect(resolvePublicApiUrl()).toBe('/api/v1');
  });
});

describe('resolvePublicLandingUrl', () => {
  it('does not treat an empty string as a configured origin', () => {
    vi.stubEnv('VITE_LANDING_URL', '');
    expect(resolvePublicLandingUrl()).toBe('http://localhost:3001');
  });
});

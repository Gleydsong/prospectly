import { describe, expect, it } from 'vitest';

import {
  resolveInternalRedirect,
  sanitizeExternalUrl,
} from './safe-url';

describe('resolveInternalRedirect', () => {
  it('allows relative app paths', () => {
    expect(resolveInternalRedirect('/leads/123')).toBe('/leads/123');
  });

  it('rejects protocol-relative and non-string values', () => {
    expect(resolveInternalRedirect('//evil.com')).toBe('/');
    expect(resolveInternalRedirect('/\\evil')).toBe('/');
    expect(resolveInternalRedirect('https://evil.com')).toBe('/');
    expect(resolveInternalRedirect(null)).toBe('/');
  });
});

describe('sanitizeExternalUrl', () => {
  it('allows http(s) urls and prefixes bare hosts', () => {
    expect(sanitizeExternalUrl('https://example.com/path')).toBe('https://example.com/path');
    expect(sanitizeExternalUrl('example.com')).toBe('https://example.com/');
  });

  it('rejects dangerous schemes', () => {
    expect(sanitizeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeExternalUrl('data:text/html,hi')).toBeNull();
  });
});

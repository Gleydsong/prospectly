import { describe, expect, it, vi } from 'vitest';

import {
  assignCheckoutRedirect,
  resolveInternalRedirect,
  sanitizeAvatarSrc,
  sanitizeExternalUrl,
  sanitizeMailtoHref,
  sanitizePixQrSrc,
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

describe('sanitizeAvatarSrc', () => {
  it('allows https and jpeg data urls', () => {
    expect(sanitizeAvatarSrc('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(sanitizeAvatarSrc('data:image/jpeg;base64,abc+/=')).toBe('data:image/jpeg;base64,abc+/=');
  });

  it('rejects http, javascript and svg data urls', () => {
    expect(sanitizeAvatarSrc('http://cdn.example.com/a.jpg')).toBeNull();
    expect(sanitizeAvatarSrc('javascript:alert(1)')).toBeNull();
    expect(sanitizeAvatarSrc('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
  });
});

describe('sanitizeMailtoHref', () => {
  it('allows a plain email', () => {
    expect(sanitizeMailtoHref('ana@agency.dev')).toBe('mailto:ana@agency.dev');
  });

  it('rejects query injection', () => {
    expect(sanitizeMailtoHref('ana@agency.dev?bcc=evil@x.test')).toBeNull();
    expect(sanitizeMailtoHref('ana@agency.dev&bcc=evil')).toBeNull();
  });
});

describe('sanitizePixQrSrc', () => {
  it('prefixes raw png base64 and keeps valid data urls', () => {
    expect(sanitizePixQrSrc('abc+/==')).toBe('data:image/png;base64,abc+/==');
    expect(sanitizePixQrSrc('data:image/png;base64,abc+/==')).toBe('data:image/png;base64,abc+/==');
  });

  it('rejects html data urls', () => {
    expect(sanitizePixQrSrc('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
  });
});

describe('assignCheckoutRedirect', () => {
  it('accepts AbacatePay https hosts', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign, href: 'http://localhost/' });
    assignCheckoutRedirect('https://app.abacatepay.com/pay/bill_1', 'ABACATE');
    expect(assign).toHaveBeenCalledWith('https://app.abacatepay.com/pay/bill_1');
    vi.unstubAllGlobals();
  });

  it('rejects a malicious host for card redirect', () => {
    expect(() => assignCheckoutRedirect('https://evil.example/pay', 'ABACATE')).toThrow(
      'Invalid AbacatePay redirect URL',
    );
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  assignCheckoutRedirect,
  buildGoogleMapsSearchUrl,
  buildGoogleWebSearchUrl,
  resolveInternalRedirect,
  sanitizeAvatarSrc,
  sanitizeExternalUrl,
  sanitizeMailtoHref,
  sanitizePixQrSrc,
  sanitizeTelHref,
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
    expect(sanitizeAvatarSrc('https://cdn.example.com/a.jpg')).toBe(
      'https://cdn.example.com/a.jpg',
    );
    expect(sanitizeAvatarSrc('data:image/jpeg;base64,abc+/=')).toBe(
      'data:image/jpeg;base64,abc+/=',
    );
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

describe('sanitizeTelHref', () => {
  it('allows a typical Brazilian mobile number', () => {
    expect(sanitizeTelHref('+55 (19) 99887-7666')).toBe('tel:+5519998877666');
  });

  it('rejects javascript and query injection', () => {
    expect(sanitizeTelHref('javascript:alert(1)')).toBeNull();
    expect(sanitizeTelHref('+5511999?ext=1')).toBeNull();
  });
});

describe('buildGoogleMapsSearchUrl', () => {
  it('encodes the postal query', () => {
    expect(buildGoogleMapsSearchUrl('Rua das Flores, Campinas')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Rua%20das%20Flores%2C%20Campinas',
    );
  });

  it('returns null for empty query', () => {
    expect(buildGoogleMapsSearchUrl('   ')).toBeNull();
  });
});

describe('buildGoogleWebSearchUrl', () => {
  it('encodes company and city', () => {
    expect(buildGoogleWebSearchUrl('Medic Saúde Mata Grande')).toBe(
      'https://www.google.com/search?q=Medic%20Sa%C3%BAde%20Mata%20Grande',
    );
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
  it('accepts Asaas hosted checkout urls', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign, href: 'http://localhost/' });
    assignCheckoutRedirect('https://sandbox.asaas.com/i/pay_1', 'ASAAS');
    expect(assign).toHaveBeenCalledWith('https://sandbox.asaas.com/i/pay_1');
    vi.unstubAllGlobals();
  });

  it('rejects a malicious host for checkout redirect', () => {
    expect(() => assignCheckoutRedirect('https://evil.example/pay', 'ASAAS')).toThrow(
      'Invalid Asaas redirect URL',
    );
  });
});

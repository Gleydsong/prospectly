import { describe, expect, it } from 'vitest';

import { sanitizeCaptureContext, sanitizeSentryEvent } from './observability-sanitize';

describe('sanitizeSentryEvent', () => {
  it('strips tokens, cookies, PII and request bodies', () => {
    const sanitized = sanitizeSentryEvent({
      request: {
        headers: {
          Authorization: 'Bearer super-secret-token',
          Cookie: 'refresh=abc',
          'Content-Type': 'application/json',
        },
        cookies: { refreshToken: 'abc' },
        data: { email: 'ana@agency.dev', leads: [{ company: 'Secret Ltd' }] },
        query_string: 'email=ana@agency.dev',
      },
      user: { email: 'ana@agency.dev', ip_address: '1.2.3.4', id: 'user-1' },
      extra: {
        accessToken: 'tok_123',
        refreshToken: 'ref_123',
        campaignMessage: 'Olá WhatsApp',
        correlationId: 'corr-1',
      },
      breadcrumbs: {
        values: [
          {
            category: 'http',
            message: 'POST /leads ana@agency.dev',
            data: { body: { phone: '+5511999999999' }, url: '/api/v1/leads' },
          },
        ],
      },
    });

    expect(JSON.stringify(sanitized)).not.toContain('super-secret-token');
    expect(JSON.stringify(sanitized)).not.toContain('ana@agency.dev');
    expect(JSON.stringify(sanitized)).not.toContain('tok_123');
    expect(JSON.stringify(sanitized)).not.toContain('Olá WhatsApp');
    expect(JSON.stringify(sanitized)).not.toContain('+5511999999999');
    expect(sanitized.request?.cookies).toBeUndefined();
    expect(sanitized.request?.data).toBeUndefined();
    expect(sanitized.user?.email).toBeUndefined();
    expect(sanitized.extra?.correlationId).toBe('corr-1');
    expect(sanitized.request?.headers?.['Content-Type']).toBe('application/json');
  });
});

describe('sanitizeCaptureContext', () => {
  it('redacts sensitive keys from error-boundary extras', () => {
    const sanitized = sanitizeCaptureContext({
      correlationId: 'corr-2',
      Authorization: 'Bearer abc',
      lead: { email: 'lead@example.com' },
    });
    expect(sanitized?.correlationId).toBe('corr-2');
    expect(sanitized?.Authorization).toBe('[redacted]');
    expect(JSON.stringify(sanitized)).not.toContain('lead@example.com');
  });
});

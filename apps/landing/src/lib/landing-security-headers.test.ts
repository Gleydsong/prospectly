import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildLandingSecurityHeaders, headerValue } from './landing-security-headers';

describe('buildLandingSecurityHeaders', () => {
  it('sends HSTS and drops unsafe-eval in production', () => {
    const headers = buildLandingSecurityHeaders({ NODE_ENV: 'production' });
    assert.equal(
      headerValue(headers, 'Strict-Transport-Security'),
      'max-age=15552000; includeSubDomains',
    );
    const csp = headerValue(headers, 'Content-Security-Policy') ?? '';
    assert.match(csp, /script-src 'self' 'unsafe-inline'/);
    assert.doesNotMatch(csp, /unsafe-eval/);
  });

  it('keeps unsafe-eval in development and omits HSTS on local HTTP', () => {
    const headers = buildLandingSecurityHeaders({ NODE_ENV: 'development' });
    assert.equal(headerValue(headers, 'Strict-Transport-Security'), undefined);
    const csp = headerValue(headers, 'Content-Security-Policy') ?? '';
    assert.match(csp, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
  });
});

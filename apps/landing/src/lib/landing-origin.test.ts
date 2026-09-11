import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEV_LANDING_ORIGIN,
  resolveLandingOrigin,
  shouldFailFastNextCommand,
} from './landing-origin';

describe('resolveLandingOrigin', () => {
  it('uses the localhost origin when not in production and the env is unset', () => {
    assert.equal(resolveLandingOrigin({}), DEV_LANDING_ORIGIN);
  });

  it('accepts an explicit https origin outside production', () => {
    assert.equal(
      resolveLandingOrigin({ NEXT_PUBLIC_LANDING_URL: 'https://preview.example/' }),
      'https://preview.example',
    );
  });

  it('rejects production builds without NEXT_PUBLIC_LANDING_URL', () => {
    assert.throws(
      () => resolveLandingOrigin({ NODE_ENV: 'production' }),
      /NEXT_PUBLIC_LANDING_URL must be a public https origin in production/,
    );
  });

  it('rejects production builds that still point at localhost', () => {
    assert.throws(
      () =>
        resolveLandingOrigin({
          NODE_ENV: 'production',
          NEXT_PUBLIC_LANDING_URL: 'http://localhost:3001',
        }),
      /NEXT_PUBLIC_LANDING_URL must be a public https origin in production/,
    );
  });

  it('rejects production builds that are not https', () => {
    assert.throws(
      () =>
        resolveLandingOrigin({
          NODE_ENV: 'production',
          NEXT_PUBLIC_LANDING_URL: 'http://prospectlyonboard.com',
        }),
      /NEXT_PUBLIC_LANDING_URL must be a public https origin in production/,
    );
  });

  it('returns the public https origin in production', () => {
    assert.equal(
      resolveLandingOrigin({
        NODE_ENV: 'production',
        NEXT_PUBLIC_LANDING_URL: 'https://prospectlyonboard.com/',
      }),
      'https://prospectlyonboard.com',
    );
  });
});

describe('shouldFailFastNextCommand', () => {
  it('applies to next build and next start only', () => {
    assert.equal(shouldFailFastNextCommand(['node', '/app/node_modules/next/dist/bin/next', 'build']), true);
    assert.equal(shouldFailFastNextCommand(['node', 'next', 'start', '-H', '0.0.0.0']), true);
    assert.equal(shouldFailFastNextCommand(['node', 'next', 'lint']), false);
    assert.equal(shouldFailFastNextCommand(['node', 'next', 'dev']), false);
  });
});

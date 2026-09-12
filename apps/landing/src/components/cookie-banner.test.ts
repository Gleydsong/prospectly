import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'cookie-banner.tsx'),
  'utf8',
);

describe('CookieBanner dialog', () => {
  it('is a labelled dialog, not a mute bottom bar', () => {
    assert.match(source, /<dialog\b/);
    assert.match(source, /aria-labelledby="cookie-banner-title"/);
    assert.match(source, /id="cookie-banner-title"/);
  });

  it('moves focus into the dialog and treats Escape as essential-only accept', () => {
    assert.match(source, /showModal\(/);
    assert.match(source, /\.focus\(/);
    assert.match(source, /onCancel/);
    assert.match(source, /persistEssentialConsent|writeEssentialConsent|serializeEssentialConsent/);
  });
});

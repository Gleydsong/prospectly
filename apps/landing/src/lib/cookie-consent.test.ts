import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COOKIE_CONSENT_KEY,
  parseCookieConsent,
  serializeEssentialConsent,
  writeEssentialConsent,
} from './cookie-consent';

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    store,
  };
}

describe('cookie consent persistence', () => {
  it('parses the essential-only JSON stored in localStorage', () => {
    const raw = serializeEssentialConsent('2026-09-12T12:00:00.000Z');
    const parsed = parseCookieConsent(raw);
    assert.deepEqual(parsed, {
      essential: true,
      analytics: false,
      version: '2026-08-17',
      ts: '2026-09-12T12:00:00.000Z',
    });
  });

  it('accepts the legacy essential string', () => {
    const parsed = parseCookieConsent('essential');
    assert.equal(parsed?.essential, true);
    assert.equal(parsed?.analytics, false);
  });

  it('writes essential consent under the existing key', () => {
    const storage = memoryStorage();
    const written = writeEssentialConsent(storage, () => '2026-09-12T12:00:00.000Z');
    assert.equal(storage.getItem(COOKIE_CONSENT_KEY), serializeEssentialConsent('2026-09-12T12:00:00.000Z'));
    assert.deepEqual(written, {
      essential: true,
      analytics: false,
      version: '2026-08-17',
      ts: '2026-09-12T12:00:00.000Z',
    });
  });

  it('ignores missing or invalid consent', () => {
    assert.equal(parseCookieConsent(null), null);
    assert.equal(parseCookieConsent('{'), null);
    assert.equal(parseCookieConsent(JSON.stringify({ essential: false })), null);
  });
});

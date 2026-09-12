import type { PlaywrightTestConfig } from '@playwright/test';

const essentialConsent = JSON.stringify({
  essential: true,
  analytics: false,
  version: '2026-08-17',
  ts: '2026-01-01T00:00:00.000Z',
});

export const landingOrigin = 'http://127.0.0.1:3011';

type StorageState = NonNullable<PlaywrightTestConfig['use']>['storageState'];

export const consentedStorageState: StorageState = {
  cookies: [],
  origins: [
    {
      origin: landingOrigin,
      localStorage: [{ name: 'prospectly_cookie_consent', value: essentialConsent }],
    },
  ],
};

export const emptyStorageState: StorageState = { cookies: [], origins: [] };

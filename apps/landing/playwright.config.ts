import { defineConfig, devices } from '@playwright/test';

import { consentedStorageState, landingOrigin } from './e2e/storage-state';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: landingOrigin,
    trace: 'retain-on-failure',
    storageState: consentedStorageState,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
      command: 'pnpm --filter @prospectly/landing exec next dev -H 127.0.0.1 -p 3011',
    cwd: process.cwd(),
      url: `${landingOrigin}/`,
      reuseExistingServer: false,
    timeout: 120_000,
  },
});

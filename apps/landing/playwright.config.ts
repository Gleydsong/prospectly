import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3011',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
      command: 'pnpm --filter @prospectly/landing exec next dev -H 127.0.0.1 -p 3011',
    cwd: process.cwd(),
      url: 'http://127.0.0.1:3011/',
      reuseExistingServer: false,
    timeout: 120_000,
  },
});

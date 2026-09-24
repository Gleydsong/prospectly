import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const projectDirectory = fileURLToPath(new URL('.', import.meta.url));
const e2ePort = process.env.E2E_PORT ?? '5174';
const baseURL = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: /sdr-.*\.spec\.ts/,
  fullyParallel: false,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'domain', testMatch: /sdr-domain\.spec\.ts/ },
    {
      name: 'desktop-chromium',
      testMatch: /sdr-ui\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      testMatch: /sdr-ui\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${e2ePort}`,
    cwd: projectDirectory,
    url: baseURL,
    reuseExistingServer: process.env.PW_REUSE_SERVER !== '0',
  },
});

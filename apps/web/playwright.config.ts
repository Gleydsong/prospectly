import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const projectDirectory = fileURLToPath(new URL('.', import.meta.url));
const e2ePort = process.env.E2E_PORT ?? '5173';
const baseURL = `http://127.0.0.1:${e2ePort}`;
const webServerCommand =
  process.env.E2E_WEB_SERVER ?? `pnpm dev -- --host 127.0.0.1 --port ${e2ePort}`;

export default defineConfig({
  testDir: './e2e',
  testIgnore: /api-custom-domain\.probe\.spec\.ts/,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: webServerCommand,
    cwd: projectDirectory,
    url: baseURL,
    reuseExistingServer: process.env.PW_REUSE_SERVER !== '0',
  },
});

import { defineConfig } from '@playwright/test';

/** Production DNS/CORS probe for #179. No local webServer. Skips if the CNAME does not resolve. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'api-custom-domain.probe.spec.ts',
  fullyParallel: true,
  reporter: 'list',
  timeout: 30_000,
  use: {
    trace: 'retain-on-failure',
  },
});

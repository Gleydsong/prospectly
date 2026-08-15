import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const script = join(process.cwd(), 'scripts/validate-deploy-env.mjs');

function run(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [script], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

const valid = {
  VITE_API_URL: 'https://api.example.com/api/v1',
  VITE_LANDING_URL: 'https://prospectlyonboard.com',
  VITE_GOOGLE_CLIENT_ID: 'demo.apps.googleusercontent.com',
};

describe('validate-deploy-env.mjs', () => {
  it('accepts HTTPS production values', () => {
    const result = run(valid);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('rejects missing and empty values without echoing them', () => {
    const result = run({
      VITE_API_URL: '   ',
      VITE_LANDING_URL: '',
      VITE_GOOGLE_CLIENT_ID: '',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/VITE_API_URL/);
    expect(result.stderr).toMatch(/VITE_LANDING_URL/);
    expect(result.stderr).toMatch(/VITE_GOOGLE_CLIENT_ID/);
    expect(result.stderr).not.toMatch(/\s{3}/);
  });

  it('rejects localhost, loopback, HTTP and .invalid hosts', () => {
    const httpLocal = run({
      ...valid,
      VITE_API_URL: 'http://localhost:3000/api/v1',
    });
    expect(httpLocal.status).toBe(1);
    expect(httpLocal.stderr).toMatch(/VITE_API_URL must use HTTPS/);
    expect(httpLocal.stderr).not.toContain('localhost:3000');

    const loopback = run({
      ...valid,
      VITE_LANDING_URL: 'https://127.0.0.1',
    });
    expect(loopback.status).toBe(1);
    expect(loopback.stderr).toMatch(/VITE_LANDING_URL must not use localhost/);
    expect(loopback.stderr).not.toContain('127.0.0.1');

    const invalidHost = run({
      ...valid,
      VITE_LANDING_URL: 'https://app.example.invalid',
    });
    expect(invalidHost.status).toBe(1);
    expect(invalidHost.stderr).toMatch(/\.invalid/);
  });

  it('requires /api/v1 on the API URL and forbids it on the landing URL', () => {
    const api = run({
      ...valid,
      VITE_API_URL: 'https://api.example.com/v1',
    });
    expect(api.status).toBe(1);
    expect(api.stderr).toMatch(/VITE_API_URL must end with \/api\/v1/);

    const landing = run({
      ...valid,
      VITE_LANDING_URL: 'https://prospectlyonboard.com/api/v1',
    });
    expect(landing.status).toBe(1);
    expect(landing.stderr).toMatch(/VITE_LANDING_URL must be a site origin/);
  });
});

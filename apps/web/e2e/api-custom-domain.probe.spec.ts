import { expect, test } from '@playwright/test';
import dns from 'node:dns/promises';

const API_HOST = 'api.prospectlyonboard.com';
const API_ORIGIN = `https://${API_HOST}`;
const APP_ORIGIN = 'https://app.prospectlyonboard.com';

async function apiHostResolves(): Promise<boolean> {
  try {
    await dns.lookup(API_HOST);
    return true;
  } catch {
    return false;
  }
}

test.describe('API custom domain probe (#179)', () => {
  test('health/ready and CORS credentials from the app origin', async ({ request }) => {
    test.skip(
      !(await apiHostResolves()),
      `CNAME ${API_HOST} ainda não responde — ticket 2 bloqueado`,
    );

    const health = await request.get(`${API_ORIGIN}/health/ready`, {
      headers: { Origin: APP_ORIGIN },
    });
    expect(health.ok(), `health/ready ${health.status()}`).toBeTruthy();
    expect(health.headers()['access-control-allow-origin']).toBe(APP_ORIGIN);
    expect(health.headers()['access-control-allow-credentials']).toBe('true');

    const preflight = await request.fetch(`${API_ORIGIN}/health/ready`, {
      method: 'OPTIONS',
      headers: {
        Origin: APP_ORIGIN,
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(preflight.ok(), `preflight ${preflight.status()}`).toBeTruthy();
    expect(preflight.headers()['access-control-allow-origin']).toBe(APP_ORIGIN);
    expect(preflight.headers()['access-control-allow-credentials']).toBe('true');
  });
});

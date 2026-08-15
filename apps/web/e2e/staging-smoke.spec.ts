import { expect, test, type ConsoleMessage } from '@playwright/test';

const stagingUrl = process.env.STAGING_BASE_URL;

test.describe('staging smoke (real environment)', () => {
  test.skip(!stagingUrl, 'Requires STAGING_BASE_URL. Full ops checklist: docs/deploy/render.md.');

  function origin(): string {
    if (!stagingUrl) {
      throw new Error('STAGING_BASE_URL is required');
    }
    return stagingUrl;
  }

  test('opens login on the published origin', async ({ page }) => {
    await page.goto(new URL('/login', origin()).toString());
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('redirects a protected route to login', async ({ page }) => {
    await page.goto(new URL('/leads', origin()).toString());
    await expect(page).toHaveURL(/\/login/);
  });

  test('login response sends security headers', async ({ request }) => {
    const response = await request.get(new URL('/login', origin()).toString());
    expect(response.ok()).toBeTruthy();
    const csp = response.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['strict-transport-security']).toMatch(/max-age=/);
    expect(response.headers()['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
  });

  test('index.html is not cached as immutable', async ({ request }) => {
    const response = await request.get(new URL('/', origin()).toString());
    const cache = response.headers()['cache-control'] ?? '';
    expect(cache.toLowerCase()).not.toMatch(/immutable/);
    expect(cache.toLowerCase()).toMatch(/must-revalidate|no-cache|max-age=0/);
  });

  test('hashed assets advertise immutable cache', async ({ request }) => {
    const home = await request.get(new URL('/', origin()).toString());
    const html = await home.text();
    const asset = html.match(/\/assets\/index-[^"]+\.js/)?.[0];
    expect(asset).toBeTruthy();
    const response = await request.get(new URL(asset!, origin()).toString());
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['cache-control'] ?? '').toMatch(/max-age=31536000/);
    expect(response.headers()['cache-control'] ?? '').toMatch(/immutable/);
  });

  test('login has no CSP or CORS console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message: ConsoleMessage) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(new URL('/login', origin()).toString());
    await expect(page.locator('input[type="email"]')).toBeVisible();
    expect(errors.join('\n')).not.toMatch(/Content Security Policy|CORS|Refused to execute/i);
  });

  test('billing result routes render without crashing', async ({ page }) => {
    for (const path of ['/billing/success', '/billing/cancel', '/billing/pix']) {
      await page.goto(new URL(path, origin()).toString());
      await expect(page.locator('#root')).not.toBeEmpty();
    }
  });
});

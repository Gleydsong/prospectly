import { expect, test } from '@playwright/test';

test.describe('self-hosted app fonts', () => {
  test('login uses local Outfit and JetBrains Mono without Google Fonts', async ({ page }) => {
    const googleFontUrls: string[] = [];
    const localFontUrls: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(url)) {
        googleFontUrls.push(url);
      }
      if (/\.woff2?(?:\?|$)/i.test(url)) {
        localFontUrls.push(url);
      }
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

    const light = await page.evaluate(async () => {
      await document.fonts.ready;
      await document.fonts.load('16px Outfit');
      await document.fonts.load('16px "JetBrains Mono"');

      const probe = document.createElement('code');
      probe.className = 'font-mono';
      probe.textContent = 'Aa';
      document.body.appendChild(probe);
      await document.fonts.ready;

      const result = {
        body: getComputedStyle(document.body).fontFamily,
        heading: getComputedStyle(document.querySelector('h2')!).fontFamily,
        mono: getComputedStyle(probe).fontFamily,
        outfitReady: document.fonts.check('16px Outfit'),
        jetbrainsReady: document.fonts.check('16px "JetBrains Mono"'),
        theme: document.documentElement.className,
      };
      probe.remove();
      return result;
    });

    expect(googleFontUrls, 'app must not fetch Google Fonts').toEqual([]);
    expect(localFontUrls.some((url) => /outfit/i.test(url))).toBe(true);
    expect(localFontUrls.some((url) => /jetbrains/i.test(url))).toBe(true);
    expect(localFontUrls.every((url) => !/fonts\.google/i.test(url))).toBe(true);

    expect(light.theme).toMatch(/\blight\b/);
    expect(light.body).toMatch(/Outfit/);
    expect(light.heading).toMatch(/Outfit/);
    expect(light.mono).toMatch(/JetBrains Mono/);
    expect(light.outfitReady).toBe(true);
    expect(light.jetbrainsReady).toBe(true);

    await page.locator('[data-theme-toggle]').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    const dark = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        body: getComputedStyle(document.body).fontFamily,
        heading: getComputedStyle(document.querySelector('h2')!).fontFamily,
        outfitReady: document.fonts.check('16px Outfit'),
        jetbrainsReady: document.fonts.check('16px "JetBrains Mono"'),
      };
    });

    expect(dark.body).toMatch(/Outfit/);
    expect(dark.heading).toMatch(/Outfit/);
    expect(dark.outfitReady).toBe(true);
    expect(dark.jetbrainsReady).toBe(true);
    expect(googleFontUrls).toEqual([]);
  });
});

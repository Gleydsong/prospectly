import { expect, test } from '@playwright/test';

import { emptyStorageState } from './storage-state';

test.use({ storageState: emptyStorageState });

test.describe('cookie consent dialog', () => {
  test('opens as a labelled dialog, focuses accept, and persists essentials on Escape', async ({
    page,
  }) => {
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: 'Cookies' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apenas essenciais' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('empresas certas');

    const stored = await page.evaluate(() => localStorage.getItem('prospectly_cookie_consent'));
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored as string)).toMatchObject({
      essential: true,
      analytics: false,
    });
  });
});

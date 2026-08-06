import { expect, test } from '@playwright/test';

test.describe('app shell visual baseline', () => {
  test('renders the light authentication shell', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('body')).toHaveCSS('overflow-x', 'clip');
  });

  test('keeps unauthenticated protected routes behind login', async ({ page }) => {
    await page.goto('/support');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('renders the confirmation-email grid layout', async ({ page }) => {
    await page.goto('/verify-email');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.auth-confirm')).toBeVisible();
  });
});

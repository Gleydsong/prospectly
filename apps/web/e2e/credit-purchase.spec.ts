import { expect, test } from '@playwright/test';

test.describe('credit purchase access gate', () => {
  test('keeps the selected credit offer when moving from login to registration', async ({
    page,
  }) => {
    await page.goto('/login?offer=credits-2000');

    await expect(page.locator('input[type="email"]')).toBeVisible();
    const registerLink = page.getByRole('link', { name: /criar conta|create account/i });
    await expect(registerLink).toHaveAttribute('href', '/register?offer=credits-2000');
  });

  test('does not expose the protected settings route without authentication', async ({ page }) => {
    await page.goto('/settings?offer=credits-5000');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

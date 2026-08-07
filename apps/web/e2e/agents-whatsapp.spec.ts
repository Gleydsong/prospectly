import { expect, test } from '@playwright/test';

test.describe('Agent WhatsApp route gate', () => {
  test('keeps /agents/whatsapp behind login', async ({ page }) => {
    await page.goto('/agents/whatsapp');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('keeps deep-linked whatsapp lead behind login', async ({ page }) => {
    await page.goto('/agents/whatsapp?leadId=00000000-0000-4000-8000-000000000001');
    await expect(page).toHaveURL(/\/login$/);
  });
});

import { expect, test } from '@playwright/test';

test('logs in with the local demo user and opens the SDR screen', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('demo@prospectly.dev');
  await page.locator('input[type="password"]').fill('Demo123!');
  await page.getByRole('button', { name: /sign in|entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login$/);

  const persona = page.getByRole('heading', { name: 'Como você trabalha?' });
  const appNav = page.getByRole('navigation', { name: /navegação principal|main navigation/i });
  await expect(persona.or(appNav)).toBeVisible();
  if (await persona.isVisible()) {
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(appNav).toBeVisible();
  }

  await page.goto('/sdr');
  await expect(page.getByRole('heading', { name: 'SDR' })).toBeVisible();
  await expect(page.getByText(/Autonomous sending is off|Envio autônomo desligado/)).toBeVisible();
  await expect(page.getByText('BLOCK')).toBeVisible();

  await page.goto('/sdr/research');
  await expect(
    page.getByText(
      /Research starts only for a qualified prospect|Research só começa com um prospect qualificado/,
    ),
  ).toBeVisible();
});

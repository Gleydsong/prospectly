import { expect, test } from '@playwright/test';

const publicRoutes = [
  '/v2',
  '/v2/como-funciona',
  '/v2/beneficios',
  '/v2/para-quem-e',
  '/v2/duvidas',
  '/entrar',
  '/faq',
  '/pricing',
  '/privacy',
  '/terms',
  '/cookies',
  '/en/enter',
  '/en/faq',
  '/en/pricing',
];

test.describe('landing routes', () => {
  for (const route of publicRoutes) {
    test(`${route} renders successfully`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status(), `${route} response`).toBe(200);
      await expect(page.locator('body')).not.toContainText('Application error');
    });
  }
});

test.describe('landing navigation', () => {
  test('desktop navigation opens the benefits page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop navigation is covered in the desktop project');
    await page.goto('/v2');
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Benefícios', exact: true }).click();
    await expect(page).toHaveURL(/\/v2\/beneficios$/);
    await expect(page.getByRole('heading', { name: 'Menos volume. Mais chance de fechar.' })).toBeVisible();
  });

  test('mobile menu opens the questions page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile menu is covered in the mobile project');
    await page.goto('/v2');
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Navegação móvel' })).toBeVisible();
    await page.getByRole('link', { name: 'Dúvidas frequentes', exact: true }).click();
    await expect(page).toHaveURL(/\/v2\/duvidas$/);
  });
});

test.describe('waitlist form', () => {
  test('submits successfully and shows confirmation', async ({ page }) => {
    let requestBody: Record<string, unknown> | undefined;
    await page.route('**/api/waitlist', async (route) => {
      requestBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Você entrou na lista de espera. Confira seu e-mail.' }),
      });
    });

    await page.goto('/entrar');
    await page.getByLabel('E-mail').fill('e2e@prospectly.dev');
    await page.getByRole('button', { name: 'Entrar na lista' }).click();

    await expect(page.getByRole('status')).toContainText('Você entrou na lista de espera');
    expect(requestBody).toMatchObject({
      email: 'e2e@prospectly.dev',
      locale: 'pt',
      source: 'landing-home',
    });
  });

  test('shows API errors without losing the form', async ({ page }) => {
    await page.route('**/api/waitlist', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Muitas tentativas. Tente de novo em instantes.' }),
      });
    });

    await page.goto('/entrar');
    await page.getByLabel('E-mail').fill('e2e@prospectly.dev');
    await page.getByRole('button', { name: 'Entrar na lista' }).click();

    await expect(page.locator('p[role="alert"]')).toContainText('Muitas tentativas');
    await expect(page.getByLabel('E-mail')).toBeVisible();
  });
});

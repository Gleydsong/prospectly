import { expect, test } from '@playwright/test';

const publicRoutes = [
  '/',
  '/como-funciona',
  '/beneficios',
  '/para-quem-e',
  '/duvidas',
  '/entrar',
  '/pricing',
  '/privacy',
  '/terms',
  '/cookies',
  '/en',
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

test.describe('canonical FAQ', () => {
  test('/faq permanently redirects to /duvidas', async ({ request }) => {
    const response = await request.get('/faq', { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(new URL(response.headers()['location'] ?? '', 'http://127.0.0.1:3011').pathname).toBe(
      '/duvidas',
    );
  });

  test('canonical Portuguese FAQ returns 200 with FAQPage JSON-LD', async ({ page }) => {
    const response = await page.goto('/duvidas');
    expect(response?.status(), '/duvidas response').toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Tudo claro antes de começar.' })).toBeVisible();
    await expect(page.locator('.landing-v2')).toBeVisible();
    await expect(page.getByText('PERGUNTAS FREQUENTES', { exact: true })).toBeVisible();
    const jsonLdScripts = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(
      jsonLdScripts.some((text) => text.includes('"FAQPage"') && text.includes('O que o Prospectly faz?')),
      'FAQPage JSON-LD on /duvidas',
    ).toBe(true);
  });

  test('V2 header FAQ link goes to /duvidas', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop navigation is covered in the desktop project');
    await page.goto('/');
    await expect(
      page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Dúvidas frequentes' }),
    ).toHaveAttribute('href', '/duvidas');
  });
});

test.describe('document language', () => {
  test('Portuguese home uses html lang pt-BR', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  });

  test('English home stays on /en with html lang en and an English H1', async ({ page }) => {
    const response = await page.goto('/en');
    expect(response?.status(), '/en response').toBe(200);
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Find companies worth prospecting in Brazil.' }),
    ).toBeVisible();
  });

  test('English nested routes keep html lang en', async ({ page }) => {
    await page.goto('/en/faq');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('landing navigation', () => {
  test('home shows only the V2 header (no legacy SiteHeader)', async ({ page }, testInfo) => {
    await page.goto('/');
    if (testInfo.project.name === 'desktop-chromium') {
      await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(1);
      await expect(
        page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Como funciona', exact: true }),
      ).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible();
    }
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Preços', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Início', exact: true })).toHaveCount(0);
  });

  test('desktop navigation opens the benefits page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop navigation is covered in the desktop project');
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Benefícios', exact: true }).click();
    await expect(page).toHaveURL(/\/beneficios$/);
    await expect(page.getByRole('heading', { name: 'Menos volume. Mais chance de fechar.' })).toBeVisible();
  });

  test('navbar possui apenas o botão Começar agora apontando para app.prospectlyonboard.com (sem botão Entrar)', async ({ page }, testInfo) => {
    await page.goto('/');

    await expect(page.getByRole('banner').getByRole('link', { name: 'Entrar', exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('banner').getByRole('link', { name: /começar agora/i }),
    ).toHaveAttribute('href', 'https://app.prospectlyonboard.com');

    if (testInfo.project.name === 'mobile-chromium') {
      await page.getByRole('button', { name: 'Abrir menu' }).click();
      await expect(
        page.getByRole('navigation', { name: 'Navegação móvel' }).getByRole('link', { name: 'Entrar', exact: true }),
      ).toHaveCount(0);
    }
  });

  test('mobile menu opens the questions page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile menu is covered in the mobile project');
    await page.goto('/');
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Navegação móvel' })).toBeVisible();
    await page.getByRole('link', { name: 'Dúvidas frequentes', exact: true }).click();
    await expect(page).toHaveURL(/\/duvidas$/);
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

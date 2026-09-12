import { expect, test } from '@playwright/test';

import { mockAuthenticatedSession, openPrimaryNav } from './helpers/mock-session';

test.describe('guest auth surfaces', () => {
  test('login is a public shell without authenticated chrome', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('link', { name: /esqueci|forgot/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /criar conta|create account/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar|sign in/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /abrir menu|open menu/i })).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);
    await expect(page.locator('body')).toHaveCSS('overflow-x', 'clip');
  });

  test('login keyboard path reaches submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/e-?mail/i).focus();
    await page.keyboard.type('demo@prospectly.dev');
    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="password"]')).toBeFocused();
    await page.keyboard.type('Demo123!');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /esqueci|forgot/i })).toBeFocused();
  });

  test('register, recovery and verify-email stay public', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();

    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

    await page.goto('/verify-email');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  for (const path of ['/', '/leads', '/agents', '/tools', '/support', '/pipeline', '/settings']) {
    test(`protects ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator('input[type="email"]')).toBeVisible();
    });
  }
});

test.describe('authenticated design system shell', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
  });

  test('footer shows only Prospectly and the year', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Prospectly' })).toHaveAttribute('href', '/');
    await expect(footer).toContainText(`© ${new Date().getFullYear()}`);
    await expect(footer.getByRole('link', { name: /principal|home/i })).toHaveCount(0);
    await expect(footer.getByRole('link', { name: /clientes|clients/i })).toHaveCount(0);
    await expect(footer.getByRole('link', { name: /configurações|settings/i })).toHaveCount(0);
  });

  test('primary sidebar lists Principal, Clientes, Assistentes, Ferramentas and Suporte', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');
    const nav = await openPrimaryNav(page, isMobile);

    await expect(nav.getByRole('link', { name: /principal|home/i })).toHaveAttribute('href', '/');
    await expect(nav.getByRole('link', { name: /clientes|clients/i }).first()).toHaveAttribute(
      'href',
      '/leads',
    );
    await expect(nav.getByRole('link', { name: /assistentes|agents/i })).toHaveAttribute(
      'href',
      '/agents',
    );
    await expect(nav.getByRole('link', { name: /ferramentas|tools/i })).toHaveAttribute(
      'href',
      '/tools',
    );
    await expect(nav.getByRole('link', { name: /suporte|support/i })).toHaveAttribute(
      'href',
      '/support',
    );
    await expect(nav.getByRole('link', { name: /funil|pipeline/i })).toHaveAttribute(
      'href',
      '/pipeline',
    );
  });

  test('desktop keeps the sidebar open and hides the menu button', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop chrome only');
    await page.goto('/');
    await expect(page.getByRole('button', { name: /abrir menu|open menu/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /mostrar menu|show menu/i })).toHaveCount(0);
    await expect(page.getByLabel(/navegação principal|main navigation/i)).toBeVisible();
    await expect(page.getByText('15 créditos')).toBeVisible();
  });

  test('desktop hides the sidebar from the aside and restores it from the topbar', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'desktop chrome only');
    await page.goto('/');

    const nav = page.getByLabel(/navegação principal|main navigation/i);
    await expect(nav).toBeVisible();

    await page.getByRole('button', { name: /esconder menu|hide menu/i }).click();
    await expect(page.locator('#mobile-nav')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#mobile-nav')).toHaveClass(/-translate-x-full/);
    await expect(page.getByRole('button', { name: /mostrar menu|show menu/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /esconder menu|hide menu/i })).toHaveCount(0);

    await page.getByRole('button', { name: /mostrar menu|show menu/i }).click();
    await expect(page.locator('#mobile-nav')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#mobile-nav')).toHaveClass(/translate-x-0/);
    await expect(nav).toBeVisible();
    await expect(page.getByRole('button', { name: /esconder menu|hide menu/i })).toBeVisible();
  });

  test('mobile drawer opens, closes with Escape and backdrop', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile chrome only');
    await page.goto('/');

    const sidebar = page.locator('#mobile-nav');
    await expect(sidebar).toHaveAttribute('aria-hidden', 'true');

    await page.getByRole('button', { name: /abrir menu|open menu/i }).click();
    await expect(sidebar).toHaveAttribute('aria-hidden', 'false');
    await expect(sidebar.getByRole('link', { name: /assistentes|agents/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(sidebar).toHaveAttribute('aria-hidden', 'true');

    await page.getByRole('button', { name: /abrir menu|open menu/i }).click();
    await page.getByRole('button', { name: /fechar menu|close menu/i }).first().click();
    await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
  });

  test('theme toggle switches html class without breaking the shell', async ({ page, isMobile }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveClass(/light/);

    await page.locator('[data-theme-toggle]').click();
    await expect(html).toHaveClass(/dark/);
    await expect(page.getByRole('contentinfo')).toBeVisible();

    if (!isMobile) {
      await expect(page.getByLabel(/navegação principal|main navigation/i)).toBeVisible();
    }
  });

  test('search control and slash shortcut open prospecting search', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('heading', { level: 1 }).click();
    await page.keyboard.press('ControlOrMeta+k');
    if (!page.url().includes('/search')) {
      const search = page.getByRole('link', { name: /buscar clientes|search clients/i });
      if (isMobile) {
        await search.first().click();
      } else {
        await search.last().click();
      }
    }
    await expect(page).toHaveURL(/\/search/);
  });
});

test.describe('target pages', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
  });

  test('principal renders greeting, KPIs and client table', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Clínica Odonto Vida')).toBeVisible();
    await expect(page.getByText('Pizzaria Bella Napoli')).toBeVisible();
  });

  test('clientes list shows mint gap badge and status pills', async ({ page }) => {
    await page.goto('/leads');
    await expect(page.getByRole('heading', { name: /clientes|clients/i })).toBeVisible();
    await expect(page.getByTitle(/sem site|sem website/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Clínica Odonto Vida').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /tabela|table/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /kanban/i })).toBeVisible();
  });

  test('clientes kanban uses stage columns and horizontal list', async ({ page }) => {
    await page.goto('/leads');
    await page.getByRole('button', { name: /kanban/i }).click();
    await expect(page.getByRole('listitem', { name: /novo|new/i }).first()).toBeVisible();
    await expect(page.getByText('Pizzaria Bella Napoli')).toBeVisible();
  });

  test('assistentes catalog keeps open actions', async ({ page }) => {
    await page.goto('/agents');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /abrir|open/i }).first()).toBeVisible();
  });

  test('ferramentas separates quick access from catalog', async ({ page }) => {
    await page.goto('/tools');
    const main = page.getByRole('main');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(main.getByRole('link', { name: /localizador de oportunidades|opportunity/i })).toBeVisible();
    await expect(main.getByRole('link', { name: /whatsapp/i })).toBeVisible();
    const cards = main.locator('a.group');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(cards.nth(i).locator('svg').first()).toBeVisible();
    }
  });

  test('suporte keeps mailto and required fields', async ({ page }) => {
    await page.goto('/support');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /support@/i })).toBeVisible();
    await expect(page.getByLabel(/assunto|subject/i)).toBeVisible();
    await expect(page.getByLabel(/detalhes|details/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /enviar|submit|send/i })).toBeVisible();
  });

  test('pipeline kanban remains reachable from secondary nav', async ({ page, isMobile }) => {
    await page.goto('/');
    const nav = await openPrimaryNav(page, isMobile);
    await nav.getByRole('link', { name: /funil|pipeline/i }).click();
    await expect(page).toHaveURL(/\/pipeline/);
    await expect(page.getByRole('button', { name: /rolar colunas para a direita/i })).toBeVisible();
  });
});

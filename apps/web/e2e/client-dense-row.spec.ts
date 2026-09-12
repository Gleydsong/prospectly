import { expect, test } from '@playwright/test';

import { mockAuthenticatedSession } from './helpers/mock-session';

test.describe('dense client rows and WhatsApp heuristic', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
  });

  test('search shows WhatsApp for a mobile and tel for a landline', async ({ page }) => {
    await page.goto('/search');
    await page
      .getByLabel(/histórico de pesquisas|search history/i)
      .getByRole('button', { name: /^Restaurante \/ São Paulo/ })
      .click();

    await expect(page.getByText('Farmácia do Largo')).toBeVisible();
    await expect(page.getByRole('link', { name: /99876/ })).toHaveAttribute(
      'href',
      'https://wa.me/11998765432',
    );
    await expect(page.getByText('WhatsApp (celular)')).toBeVisible();

    await expect(page.getByText('Cartório Central')).toBeVisible();
    await expect(page.getByRole('link', { name: /3234/ })).toHaveAttribute(
      'href',
      'tel:1132345678',
    );
    await expect(page.getByRole('link', { name: /3234/ })).not.toHaveAttribute('href', /wa\.me/);
    await expect(page.getByRole('button', { name: 'Enviar para CRM' }).first()).toBeVisible();
  });

  test('search result CTAs share the same column when phone is missing', async ({ page }) => {
    await page.goto('/search');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByLabel(/histórico de pesquisas|search history/i)
      .getByRole('button', { name: /^Restaurante \/ São Paulo/ })
      .click();

    const buttons = page.locator('.client-dense-row').getByRole('button', { name: /Enviar para CRM|No CRM/ });
    await expect(buttons.first()).toBeVisible();
    const count = await buttons.count();
    const xs: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const box = await buttons.nth(index).boundingBox();
      expect(box).toBeTruthy();
      xs.push(box!.x);
    }
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(4);
  });

  test('clients list shows phone and channel on the dense row', async ({ page }) => {
    await page.goto('/leads');

    await expect(page.getByText('Clínica Odonto Vida').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /99876/ })).toHaveAttribute(
      'href',
      'https://wa.me/11998765432',
    );
    await expect(page.getByText('WhatsApp (celular)')).toBeVisible();

    await expect(page.getByRole('link', { name: /3234/ })).toHaveAttribute(
      'href',
      'tel:1132345678',
    );
    await expect(page.getByRole('button', { name: /abrir|open/i }).first()).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';

import { mockAuthenticatedSession, openPrimaryNav } from './helpers/mock-session';

test.describe('SDR screens', () => {
  test('keeps the control plane behind login', async ({ page }) => {
    await page.goto('/sdr');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('shows sending off, a blocked message, and the research block', async ({
    page,
  }, testInfo) => {
    await mockAuthenticatedSession(page);
    await page.goto('/sdr');

    await expect(page.getByRole('heading', { name: 'SDR' })).toBeVisible();
    await expect(page.getByText('Envio autônomo desligado')).toBeVisible();
    await expect(page.getByText('Sem campanha · DRAFT')).toBeVisible();
    await expect(page.getByText('BLOCK')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aprovar' })).toHaveCount(0);

    if (testInfo.project.name === 'desktop-chromium') {
      const nav = await openPrimaryNav(page, false);
      await expect(nav.getByRole('link', { name: 'SDR' })).toHaveAttribute('href', '/sdr');
    }

    await page.goto('/sdr/research');
    await expect(
      page.getByText('Research só começa com um prospect qualificado e evidência viva.'),
    ).toBeVisible();
  });
});

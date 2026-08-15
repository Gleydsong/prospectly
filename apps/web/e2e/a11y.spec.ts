import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { mockAuthenticatedApi, seedAuthenticatedSession } from './helpers/session';

async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

test.describe('accessibility gates', () => {
  test('login and register have no serious or critical violations', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expectNoSeriousAxeViolations(page);

    await page.goto('/register');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expectNoSeriousAxeViolations(page);
  });

  test.describe('authenticated routes', () => {
    test.beforeEach(async ({ page }) => {
      await seedAuthenticatedSession(page);
      await mockAuthenticatedApi(page);
    });

    test('authenticated shell and primary routes have no serious or critical violations', async ({
      page,
    }) => {
      test.setTimeout(90_000);
      const routes = [
        '/',
        '/search',
        '/leads',
        '/pipeline',
        '/campaigns',
        '/tools/opportunity-finder',
      ];

      for (const route of routes) {
        await page.goto(route);
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.locator('#root')).not.toBeEmpty();
        await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 20_000 });
        await expectNoSeriousAxeViolations(page);
      }
    });
  });
});

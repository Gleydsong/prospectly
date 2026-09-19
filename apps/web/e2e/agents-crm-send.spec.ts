import { expect, test, type Page, type Route } from '@playwright/test';

import { mockAuthenticatedSession } from './helpers/mock-session';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function searchResult(id: string, companyName: string) {
  const business = {
    externalId: id,
    companyName,
    city: 'Afogados da Ingazeira',
    state: 'PE',
    country: 'BR',
    source: 'OPENSTREETMAP',
    websitePresence: 'NO_WEBSITE_REPORTED',
  };
  return {
    id,
    data: business,
    normalizedData: business,
    websitePresence: 'NO_WEBSITE_REPORTED',
    importedLeadId: null,
    createdAt: '2026-07-22T10:00:00.000Z',
  };
}

function pickerLead(
  id: string,
  companyName: string,
  extras: { city?: string; createdAt?: string } = {},
) {
  return {
    id,
    companyName,
    city: extras.city ?? 'Afogados da Ingazeira',
    segment: 'hairdresser',
    status: 'NEW',
    source: 'SEARCH',
    score: 35,
    doNotContact: false,
    tags: [],
    createdAt: extras.createdAt ?? '2026-08-10T10:00:00.000Z',
    updatedAt: extras.createdAt ?? '2026-08-10T10:00:00.000Z',
  };
}

const PICKER_LEADS = [
  ...Array.from({ length: 15 }, (_, index) =>
    pickerLead(`lead-${index + 1}`, `Empresa ${index + 1}`),
  ),
  pickerLead('lead-recife', 'Studio Recife', {
    city: 'Recife',
    createdAt: '2026-09-19T12:00:00.000Z',
  }),
];

async function mockCrmSendApis(page: Page) {
  await page.route(/\/api\/v1\/searches\/[^/]+\/results(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    const pageNum = Number(url.searchParams.get('page') ?? '1');
    const result =
      pageNum === 1
        ? searchResult('result-page-1', 'Barbearia Página Um')
        : searchResult('result-page-2', 'Studio Página Dois');
    return json(route, {
      data: [result],
      meta: { page: pageNum, pageSize: 20, total: 2, totalPages: 2 },
    });
  });

  await page.route(/\/api\/v1\/searches\/[^/]+\/import(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return json(route, {
      imported: 2,
      skipped: 0,
      invalid: 0,
      conflicts: 0,
      items: [],
    });
  });

  await page.route(/\/api\/v1\/agents\/crm\/daily-focus(?:\?|$)/, async (route) => {
    return json(route, { items: [], totalCount: 0 });
  });

  await page.route(/\/api\/v1\/leads(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    const pageNum = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '12');
    const city = (url.searchParams.get('city') ?? '').trim().toLowerCase();
    const createdFrom = url.searchParams.get('createdFrom') ?? '';
    const createdTo = url.searchParams.get('createdTo') ?? '';

    const filtered = PICKER_LEADS.filter((lead) => {
      if (city && !(lead.city ?? '').toLowerCase().includes(city)) return false;
      const day = lead.createdAt.slice(0, 10);
      if (createdFrom && day < createdFrom) return false;
      if (createdTo && day > createdTo) return false;
      return true;
    });
    const start = (pageNum - 1) * pageSize;
    return json(route, {
      data: filtered.slice(start, start + pageSize),
      meta: {
        page: pageNum,
        pageSize,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / Math.max(pageSize, 1))),
      },
    });
  });
}

test.describe('CRM send and picker', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockCrmSendApis(page);
  });

  test('keeps selected search results across pages and sends every id to the CRM', async ({
    page,
  }) => {
    await page.goto('/search');
    await page
      .getByLabel(/histórico de pesquisas|search history/i)
      .getByRole('button', { name: /^Restaurante \/ São Paulo/ })
      .click();

    await page.getByRole('checkbox', { name: 'Selecionar Barbearia Página Um' }).check();
    await expect(page.getByRole('button', { name: 'Enviar para CRM (1)', exact: true })).toBeEnabled();

    await page
      .getByRole('navigation', { name: 'Paginação' })
      .filter({ hasText: /página 1 de 2/i })
      .getByRole('button', { name: 'Próxima página' })
      .click();

    await expect(page.getByRole('checkbox', { name: 'Selecionar Studio Página Dois' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar para CRM (1)', exact: true })).toBeEnabled();
    await page.getByRole('checkbox', { name: 'Selecionar Studio Página Dois' }).check();

    const importRequest = page.waitForRequest(
      (request) => request.method() === 'POST' && /\/searches\/[^/]+\/import$/.test(new URL(request.url()).pathname),
    );
    await page.getByRole('button', { name: 'Enviar para CRM (2)', exact: true }).click();
    const posted = await importRequest;
    expect(posted.postDataJSON()).toEqual({
      resultIds: ['result-page-1', 'result-page-2'],
    });
  });

  test('paginates CRM picker so older sent leads stay reachable', async ({ page }) => {
    await page.goto('/agents/crm');

    await expect(page.getByRole('button', { name: 'Empresa 1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Empresa 13', exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Próxima página' }).click();

    await expect(page.getByRole('button', { name: 'Empresa 13', exact: true })).toBeVisible();
    await expect(page.getByText(/16 resultados/i)).toBeVisible();
  });

  test('filters CRM picker by city and send date', async ({ page }) => {
    await page.goto('/agents/crm');
    await expect(page.getByRole('button', { name: 'Empresa 1', exact: true })).toBeVisible();

    await page.getByLabel('Cidade').fill('Recife');
    await page.getByLabel('Enviado de').fill('2026-09-01');
    await page.getByLabel('Enviado até').fill('2026-09-19');

    await expect(page.getByRole('button', { name: 'Studio Recife', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Empresa 1', exact: true })).toHaveCount(0);
    await expect(page.getByText(/Enviado em/i).first()).toBeVisible();
  });
});

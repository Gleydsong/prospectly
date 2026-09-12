import { expect, test, type Page } from '@playwright/test';

const AUTH_STATE = {
  state: {
    user: {
      id: 'user-1',
      name: 'Guia Teste',
      email: 'guia@prospectly.test',
      organizationId: 'org-1',
      organizationName: 'Prospectly Test',
      role: 'OWNER',
      locale: 'pt',
      emailVerifiedAt: '2026-08-12T10:00:00.000Z',
    },
  },
  version: 0,
};

function opportunityRunPayload(id: string, niche: string, city = 'Jaboatão dos Guararapes', state = 'PE') {
  return {
    id,
    status: 'COMPLETED',
    service: 'Criar site',
    city,
    state,
    country: 'BR',
    scoringVersion: 'opportunity-score-v1',
    candidateCount: 1,
    analyzedCount: 1,
    failedCount: 0,
    profile: {
      service: 'Criar site',
      niche,
      targetCustomer: [niche],
      categories: [],
      relevantSignals: ['MISSING_WEBSITE'],
    },
    startedAt: '2026-09-10T10:00:00.000Z',
    completedAt: '2026-09-10T10:00:02.000Z',
    createdAt: '2026-09-10T10:00:00.000Z',
  };
}

async function mockLoggedInOpportunityFinder(page: Page) {
  const nichesByRun = new Map<string, string>();
  let lastNiche = 'clinicas';
  let seq = 0;

  await page.addInitScript((auth) => {
    localStorage.setItem('prospectly-auth', JSON.stringify(auth));
  }, AUTH_STATE);

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (path.endsWith('/auth/refresh')) return json({ accessToken: 'e2e-token' });
    if (path.endsWith('/users/me')) return json({ name: 'Guia Teste', emailVerifiedAt: '2026-08-12T10:00:00.000Z' });
    if (path.endsWith('/geo/regions')) {
      return json([
        { code: 'PE', name: 'Pernambuco' },
        { code: 'SP', name: 'São Paulo' },
      ]);
    }
    if (path.endsWith('/geo/cities')) {
      return json(
        url.searchParams.get('region') === 'PE'
          ? [{ name: 'Jaboatão dos Guararapes' }]
          : [{ name: 'São Paulo' }],
      );
    }

    if (path.endsWith('/opportunity-finder/runs') && request.method() === 'POST') {
      const payload = request.postDataJSON() as { niche?: string };
      const niche = payload.niche?.trim() || lastNiche;
      lastNiche = niche;
      seq += 1;
      const id = `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
      nichesByRun.set(id, niche);
      return json(opportunityRunPayload(id, niche), 202);
    }

    const runMatch = path.match(/\/opportunity-finder\/runs\/([^/]+)$/);
    if (runMatch && request.method() === 'GET') {
      const id = runMatch[1]!;
      return json(opportunityRunPayload(id, nichesByRun.get(id) ?? lastNiche));
    }

    if (path.endsWith('/candidates') && request.method() === 'GET') {
      const runId = path.match(/\/opportunity-finder\/runs\/([^/]+)\/candidates$/)?.[1] ?? 'unknown';
      return json({
        data: [{
          id: `00000000-0000-4000-8000-${runId.slice(-12)}`,
          runId,
          status: 'SCORED',
          company: {
            externalId: `places/${runId}`,
            companyName: 'Clínica Boa Vista',
            category: 'clinic',
            phone: '+5581999999999',
            city: 'Jaboatão dos Guararapes',
            state: 'PE',
            country: 'BR',
            rating: 4.6,
            reviewCount: 40,
            source: 'GOOGLE_PLACES',
            websitePresence: 'NO_WEBSITE_REPORTED',
          },
          signals: [{
            type: 'MISSING_WEBSITE',
            value: 'TRUE',
            source: 'PROVIDER',
            confidence: 0.58,
            evidence: 'A fonte não informou o site.',
            kind: 'INFERENCE',
            checkedAt: '2026-09-10T10:00:01.000Z',
          }],
          scoreBreakdown: {
            version: 'opportunity-score-v1',
            dna: { need: 90, quality: 85, reach: 70, timing: 75, fit: 100 },
            reasons: [],
          },
          overallScore: 84,
          confidenceScore: 70,
          dataCompleteness: 65,
          rankingCategory: 'HIGH',
          importedLeadId: null,
        }],
        total: 1,
      });
    }

    return json({ creditBalance: 10, searchUsage: { used: 0, limit: null, remaining: null, unlimited: true } });
  });
}

test.describe('AI Opportunity Finder route gate', () => {
  test('keeps the tool behind the existing authentication gate', async ({ page }) => {
    await page.goto('/tools/opportunity-finder');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

test.describe('AI Opportunity Finder happy path', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('prospectly-auth', JSON.stringify({ state: { user: {
        id: 'user-1', name: 'Guia Teste', email: 'guia@prospectly.test', organizationId: 'org-1',
        organizationName: 'Prospectly Test', role: 'OWNER', locale: 'pt', emailVerifiedAt: '2026-08-12T10:00:00.000Z',
      } }, version: 0 }));
    });
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (path.endsWith('/auth/refresh')) return json({ accessToken: 'e2e-token' });
      if (path.endsWith('/users/me')) return json({ name: 'Guia Teste', emailVerifiedAt: '2026-08-12T10:00:00.000Z' });
      if (path.endsWith('/geo/regions')) return json([{ code: 'SP', name: 'São Paulo' }]);
      if (path.endsWith('/geo/cities')) return json([{ name: 'São Paulo' }]);
      if (path.endsWith('/opportunity-finder/runs') && request.method() === 'POST') return json({
        id: '00000000-0000-4000-8000-000000000001', status: 'PREPARING', service: 'Criação de sites',
        city: 'São Paulo', state: 'SP', country: 'BR', scoringVersion: 'opportunity-score-v1',
        candidateCount: 0, analyzedCount: 0, failedCount: 0,
        startedAt: '2026-08-12T10:00:00.000Z', createdAt: '2026-08-12T10:00:00.000Z',
      }, 202);
      if (path.endsWith('/opportunity-finder/runs/00000000-0000-4000-8000-000000000001')) return json({
        id: '00000000-0000-4000-8000-000000000001', status: 'COMPLETED', service: 'Criação de sites',
        city: 'São Paulo', state: 'SP', country: 'BR', scoringVersion: 'opportunity-score-v1',
        candidateCount: 1, analyzedCount: 1, failedCount: 0,
        profile: { service: 'Criação de sites', niche: 'Roupas de atacados', targetCustomer: ['lojas de roupas'], categories: ['clothes'], relevantSignals: ['MISSING_WEBSITE'] },
        startedAt: '2026-08-12T10:00:00.000Z', completedAt: '2026-08-12T10:00:02.000Z', createdAt: '2026-08-12T10:00:00.000Z',
      });
      if (path.endsWith('/candidates') && request.method() === 'GET') return json({ data: [{
        id: '00000000-0000-4000-8000-000000000003', runId: '00000000-0000-4000-8000-000000000001', status: 'SCORED',
        company: { externalId: 'places/1', companyName: 'Moda Atacado', category: 'clothes', phone: '+5511999999999', city: 'São Paulo', state: 'SP', country: 'BR', rating: 4.8, reviewCount: 120, source: 'GOOGLE_PLACES', websitePresence: 'NO_WEBSITE_REPORTED' },
        signals: [{ type: 'MISSING_WEBSITE', value: 'TRUE', source: 'PROVIDER', confidence: 0.58, evidence: 'A fonte não informou o site.', kind: 'INFERENCE', checkedAt: '2026-08-12T10:00:01.000Z' }],
        scoreBreakdown: { version: 'opportunity-score-v1', dna: { need: 90, quality: 85, reach: 70, timing: 75, fit: 100 }, reasons: [] },
        overallScore: 88, confidenceScore: 72, dataCompleteness: 68, rankingCategory: 'EXCELLENT', importedLeadId: null,
      }], total: 1 });
      if (path.endsWith('/save-lead') && request.method() === 'POST') return json({ status: 'CREATED', leadId: 'lead-1' });
      return json({ creditBalance: 10, searchUsage: { used: 0, limit: null, remaining: null, unlimited: true } });
    });
  });

  test('opens from Tools, ranks evidence and saves a reviewed lead', async ({ page }) => {
    await page.goto('/tools');
    await page.getByRole('link', { name: /Localizador de Oportunidades com IA/i }).first().click();
    await expect(page).toHaveURL(/\/tools\/opportunity-finder$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Localizador de Oportunidades com IA' })).toBeVisible();
    await page.getByLabel('O que você vende?').fill('Criação de sites');
    await page.getByLabel('Qual nicho deseja encontrar?').fill('Roupas de atacados');
    await page.getByLabel('Estado').selectOption('SP');
    await page.getByLabel('Cidade').selectOption('São Paulo');
    const createRequestPromise = page.waitForRequest((request) =>
      request.url().endsWith('/opportunity-finder/runs') && request.method() === 'POST');
    await page.getByRole('button', { name: /Encontrar oportunidades/i }).click();
    const createRequest = await createRequestPromise;
    expect(createRequest.postDataJSON()).toMatchObject({
      service: 'Criação de sites',
      niche: 'Roupas de atacados',
    });
    await expect(page.getByText('Moda Atacado')).toBeVisible();
    await page.getByRole('button', { name: 'Ver evidências' }).click();
    await expect(page.getByRole('dialog')).toContainText('A fonte não informou o site.');
    await page.getByRole('button', { name: /Salvar como cliente potencial/ }).click();
    await expect(page.getByRole('button', { name: 'Salvo como cliente potencial' })).toBeDisabled();
  });
});

test.describe('AI Opportunity Finder niche variants', () => {
  test.beforeEach(async ({ page }) => {
    await mockLoggedInOpportunityFinder(page);
  });

  test('shows the full niche catalog instead of three options', async ({ page }) => {
    await page.goto('/tools/opportunity-finder');
    const chips = page.getByLabel('Nichos com variantes de busca').getByRole('button');
    await expect(chips).toHaveCount(18);
    await expect(page.getByRole('button', { name: 'Clínica', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restaurante', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Loja de roupas', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Farmácia', exact: true })).toBeVisible();
  });

  test('fills Clínica from a chip and searches clinicas in Jaboatão without a plan block', async ({ page }) => {
    await page.goto('/tools/opportunity-finder');
    await page.getByRole('button', { name: 'Clínica', exact: true }).click();
    await expect(page.getByLabel('Qual nicho deseja encontrar?')).toHaveValue('Clínica');

    await page.getByLabel('Qual nicho deseja encontrar?').fill('clinicas');
    await page.getByLabel('O que você vende?').fill('Criar site');
    await page.getByLabel('Estado').selectOption('PE');
    await page.getByLabel('Cidade').selectOption('Jaboatão dos Guararapes');

    const createResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/opportunity-finder/runs')
      && response.request().method() === 'POST'
      && !response.url().includes('/candidates'));
    await page.getByRole('button', { name: /Encontrar oportunidades/i }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(202);
    expect(createResponse.request().postDataJSON()).toMatchObject({
      service: 'Criar site',
      niche: 'clinicas',
      city: 'Jaboatão dos Guararapes',
      state: 'PE',
    });

    await expect(page.getByText('O nicho informado não está disponível no plano atual.')).toHaveCount(0);
    await expect(page.getByText('Clínica Boa Vista')).toBeVisible();
    await expect(page.getByText('procurando “clinicas”')).toBeVisible();
  });

  test('accepts catalog aliases and free-text niches the user types', async ({ page }) => {
    test.setTimeout(120_000);
    const niches = [
      'clinicas',
      'pizzarias',
      'salão de beleza',
      'pet shop',
      'academia',
      'autoescola',
      'oficina mecânica',
      'imobiliária',
      'consultoria de processos',
      'loja de suplementos',
      'lava jato',
      'coworking',
      'fábrica de paletes',
    ];

    await page.goto('/tools/opportunity-finder');
    await page.getByLabel('O que você vende?').fill('Criar site');
    await page.getByLabel('Estado').selectOption('PE');
    await page.getByLabel('Cidade').selectOption('Jaboatão dos Guararapes');

    const findButton = page.getByRole('button', { name: /Encontrar oportunidades/i });

    for (const niche of niches) {
      await expect(findButton).toBeEnabled();
      await page.getByLabel('Qual nicho deseja encontrar?').fill(niche);
      const createResponsePromise = page.waitForResponse((response) =>
        response.url().includes('/opportunity-finder/runs')
        && response.request().method() === 'POST'
        && !response.url().includes('/candidates'));
      await findButton.click();
      const createResponse = await createResponsePromise;
      expect(createResponse.status()).toBe(202);
      expect(createResponse.request().postDataJSON()).toMatchObject({
        service: 'Criar site',
        niche,
        city: 'Jaboatão dos Guararapes',
        state: 'PE',
      });
      await expect(page.getByText('Não foi possível identificar o nicho', { exact: false })).toHaveCount(0);
      await expect(page.getByText('O nicho informado não está disponível no plano atual.')).toHaveCount(0);
      await expect(page.getByText(`procurando “${niche}”`)).toBeVisible();
      await expect(findButton).toBeEnabled();
    }
  });
});

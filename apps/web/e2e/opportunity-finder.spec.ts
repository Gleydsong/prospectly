import { expect, test } from '@playwright/test';

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
  const runId = '00000000-0000-4000-8000-000000000011';
  const candidateId = '00000000-0000-4000-8000-000000000012';

  test.beforeEach(async ({ page }) => {
    let lastNiche = 'clinicas';
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
        lastNiche = payload.niche?.trim() || lastNiche;
        return json({
          id: runId,
          status: 'COMPLETED',
          service: 'Criação de sites',
          city: 'Jaboatão dos Guararapes',
          state: 'PE',
          country: 'BR',
          scoringVersion: 'opportunity-score-v1',
          candidateCount: 1,
          analyzedCount: 1,
          failedCount: 0,
          profile: {
            service: 'Criação de sites',
            niche: lastNiche,
            targetCustomer: [lastNiche],
            categories: ['clinic'],
            relevantSignals: ['MISSING_WEBSITE'],
          },
          startedAt: '2026-09-10T10:00:00.000Z',
          completedAt: '2026-09-10T10:00:02.000Z',
          createdAt: '2026-09-10T10:00:00.000Z',
        }, 202);
      }
      if (path.endsWith(`/opportunity-finder/runs/${runId}`)) {
        return json({
          id: runId,
          status: 'COMPLETED',
          service: 'Criação de sites',
          city: 'Jaboatão dos Guararapes',
          state: 'PE',
          country: 'BR',
          scoringVersion: 'opportunity-score-v1',
          candidateCount: 1,
          analyzedCount: 1,
          failedCount: 0,
          profile: {
            service: 'Criação de sites',
            niche: lastNiche,
            targetCustomer: [lastNiche],
            categories: ['clinic'],
            relevantSignals: ['MISSING_WEBSITE'],
          },
          startedAt: '2026-09-10T10:00:00.000Z',
          completedAt: '2026-09-10T10:00:02.000Z',
          createdAt: '2026-09-10T10:00:00.000Z',
        });
      }
      if (path.endsWith('/candidates') && request.method() === 'GET') {
        return json({
          data: [{
            id: candidateId,
            runId,
            status: 'SCORED',
            company: {
              externalId: 'places/clinic-1',
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

    const createRequestPromise = page.waitForRequest((request) =>
      request.url().endsWith('/opportunity-finder/runs') && request.method() === 'POST');
    await page.getByRole('button', { name: /Encontrar oportunidades/i }).click();
    const createRequest = await createRequestPromise;
    expect(createRequest.postDataJSON()).toMatchObject({
      service: 'Criar site',
      niche: 'clinicas',
      city: 'Jaboatão dos Guararapes',
      state: 'PE',
    });

    await expect(page.getByText('O nicho informado não está disponível no plano atual.')).toHaveCount(0);
    await expect(page.getByText('Clínica Boa Vista')).toBeVisible();
    await expect(page.getByText(/procurando\s+“clinicas”/i)).toBeVisible();
  });
});

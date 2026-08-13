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
        profile: { service: 'Criação de sites', targetCustomer: ['clínicas brasileiras'], categories: ['clinic'], relevantSignals: ['MISSING_WEBSITE'] },
        startedAt: '2026-08-12T10:00:00.000Z', completedAt: '2026-08-12T10:00:02.000Z', createdAt: '2026-08-12T10:00:00.000Z',
      });
      if (path.endsWith('/candidates') && request.method() === 'GET') return json({ data: [{
        id: '00000000-0000-4000-8000-000000000003', runId: '00000000-0000-4000-8000-000000000001', status: 'SCORED',
        company: { externalId: 'places/1', companyName: 'Clínica Vita', category: 'clinic', phone: '+5511999999999', city: 'São Paulo', state: 'SP', country: 'BR', rating: 4.8, reviewCount: 120, source: 'GOOGLE_PLACES', websitePresence: 'NO_WEBSITE_REPORTED' },
        signals: [{ type: 'MISSING_WEBSITE', value: 'TRUE', source: 'PROVIDER', confidence: 0.58, evidence: 'A fonte não reportou website.', kind: 'INFERENCE', checkedAt: '2026-08-12T10:00:01.000Z' }],
        scoreBreakdown: { version: 'opportunity-score-v1', dna: { need: 90, quality: 85, reach: 70, timing: 75, fit: 100 }, reasons: [] },
        overallScore: 88, confidenceScore: 72, dataCompleteness: 68, rankingCategory: 'EXCELLENT', importedLeadId: null,
      }], total: 1 });
      if (path.endsWith('/save-lead') && request.method() === 'POST') return json({ status: 'CREATED', leadId: 'lead-1' });
      return json({ creditBalance: 10, searchUsage: { used: 0, limit: null, remaining: null, unlimited: true } });
    });
  });

  test('opens from Tools, ranks evidence and saves a reviewed lead', async ({ page }) => {
    await page.goto('/tools');
    await page.getByRole('link', { name: /AI Opportunity Finder/i }).first().click();
    await expect(page).toHaveURL(/\/tools\/opportunity-finder$/);
    await expect(page.getByRole('heading', { level: 1, name: 'AI Opportunity Finder' })).toBeVisible();
    await page.getByLabel('O que você vende?').fill('Criação de sites para clínicas');
    await page.getByLabel('Estado').selectOption('SP');
    await page.getByLabel('Cidade').selectOption('São Paulo');
    await page.getByRole('button', { name: /Encontrar oportunidades/i }).click();
    await expect(page.getByText('Clínica Vita')).toBeVisible();
    await page.getByRole('button', { name: 'Ver evidências' }).click();
    await expect(page.getByRole('dialog')).toContainText('A fonte não reportou website.');
    await page.getByRole('button', { name: /Salvar como lead/ }).click();
    await expect(page.getByRole('button', { name: 'Salvo como lead' })).toBeDisabled();
  });
});

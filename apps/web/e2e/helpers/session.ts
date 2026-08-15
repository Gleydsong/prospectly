import type { Page } from '@playwright/test';

export const E2E_USER = {
  id: 'user-1',
  name: 'Guia Teste',
  email: 'guia@prospectly.test',
  organizationId: 'org-1',
  organizationName: 'Prospectly Test',
  role: 'OWNER',
  locale: 'pt',
  emailVerifiedAt: '2026-08-12T10:00:00.000Z',
};

export async function seedAuthenticatedSession(page: Page): Promise<void> {
  await page.addInitScript((user) => {
    localStorage.setItem('prospectly-auth', JSON.stringify({ state: { user }, version: 0 }));
  }, E2E_USER);
}

export async function mockAuthenticatedApi(page: Page): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path.endsWith('/auth/refresh')) return json({ accessToken: 'e2e-token' });
    if (path.includes('/dashboard/summary')) {
      return json({
        totalLeads: 0,
        newLeads: 0,
        qualified: 0,
        contacted: 0,
        meetings: 0,
        proposals: 0,
        won: 0,
        lost: 0,
        conversionRate: 0,
        overdueTasks: 0,
        overdueFollowUps: [],
        upcomingFollowUps: [],
        topOpportunities: [],
        conversionBySource: [],
      });
    }
    if (path.endsWith('/users/me')) {
      return json({
        name: E2E_USER.name,
        emailVerifiedAt: E2E_USER.emailVerifiedAt,
        memberships: [
          {
            role: E2E_USER.role,
            organization: { id: E2E_USER.organizationId, name: E2E_USER.organizationName },
          },
        ],
      });
    }
    if (path.includes('/dashboard/')) {
      return json({
        period: '30d',
        leads: { total: 0, new: 0, contacted: 0, qualified: 0, won: 0 },
        tasks: { open: 0, overdue: 0 },
        campaigns: { active: 0 },
        credits: { balance: 10 },
      });
    }
    if (path.endsWith('/geo/regions')) return json([{ code: 'SP', name: 'São Paulo' }]);
    if (path.endsWith('/geo/cities')) return json([{ name: 'São Paulo' }]);
    return json({ data: [], meta: { total: 0, page: 1, pageSize: 20 }, creditBalance: 10 });
  });
}

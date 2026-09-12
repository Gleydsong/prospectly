import { expect, type Page, type Route } from '@playwright/test';

export const E2E_AUTH = {
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
    accessToken: 'e2e-token',
  },
  version: 0,
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function mockAuthenticatedSession(page: Page) {
  await page.addInitScript((auth) => {
    localStorage.setItem('prospectly-auth', JSON.stringify(auth));
    localStorage.setItem('prospectly:theme', 'light');
  }, E2E_AUTH);

  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path.endsWith('/auth/refresh')) return json(route, { accessToken: 'e2e-token' });
    if (path.endsWith('/users/me')) {
      return json(route, {
        name: 'Guia Teste',
        email: 'guia@prospectly.test',
        emailVerifiedAt: '2026-08-12T10:00:00.000Z',
        locale: 'pt',
      });
    }
    if (path.endsWith('/billing/current') || path.endsWith('/billing/status')) {
      return json(route, {
        creditBalance: 15,
        plan: 'STARTER',
        status: 'ACTIVE',
        canExportCsv: true,
        searchUsage: { used: 5, limit: 50, remaining: 45, unlimited: false },
      });
    }
    if (path.endsWith('/dashboard/summary')) {
      return json(route, {
        totalLeads: 42,
        newLeads: 31,
        qualified: 5,
        contacted: 3,
        meetings: 2,
        proposals: 1,
        won: 3,
        lost: 0,
        conversionRate: 0.1,
        overdueTasks: 0,
        overdueFollowUps: [],
        upcomingFollowUps: [],
        topOpportunities: [],
        conversionBySource: [],
      });
    }
    if (path.endsWith('/custom-fields')) return json(route, []);
    if (path.endsWith('/views')) return json(route, []);
    if (path.endsWith('/agents')) {
      return json(route, {
        data: [
          {
            id: 'crm-next-action',
            name: 'Próxima ação CRM',
            description: 'Sugere o próximo passo comercial.',
            path: '/agents/crm',
          },
          {
            id: 'whatsapp-first-message',
            name: 'Primeira mensagem WhatsApp',
            description: 'Gera uma abertura para o lead.',
            path: '/agents/whatsapp',
          },
        ],
      });
    }
    if (path.endsWith('/leads')) {
      return json(route, {
        data: [
          {
            id: 'lead-1',
            companyName: 'Clínica Odonto Vida',
            city: 'São Paulo',
            state: 'SP',
            category: 'dentist',
            segment: 'Saúde Odontológica',
            status: 'QUALIFIED',
            score: 85,
            website: null,
            phone: '(11) 99876-5432',
            email: 'contato@odonto.test',
            createdAt: '2026-08-10T10:00:00.000Z',
            updatedAt: '2026-08-10T10:00:00.000Z',
          },
          {
            id: 'lead-2',
            companyName: 'Pizzaria Bella Napoli',
            city: 'São Paulo',
            state: 'SP',
            category: 'restaurant',
            segment: 'Gastronomia',
            status: 'NEW',
            score: 92,
            website: null,
            phone: '(11) 3234-5678',
            email: 'contato@bella.test',
            createdAt: '2026-08-10T10:00:00.000Z',
            updatedAt: '2026-08-10T10:00:00.000Z',
          },
          {
            id: 'lead-3',
            companyName: 'Studio Aurora',
            city: 'Curitiba',
            status: 'CONTACTED',
            score: 74,
            website: 'https://studioaurora.example',
            createdAt: '2026-08-10T10:00:00.000Z',
            updatedAt: '2026-08-10T10:00:00.000Z',
          },
        ],
        meta: { page: 1, pageSize: 20, total: 3, totalPages: 1 },
      });
    }
    if (path.endsWith('/pipelines/board')) {
      return json(route, {
        pipeline: { id: 'pipe-1', name: 'Funil Principal' },
        limit: 50,
        offset: 0,
        stages: [
          {
            id: 'stage-new',
            name: 'Prospecção',
            order: 0,
            totalCount: 1,
            hasMore: false,
            leads: [{ id: 'lead-2', companyName: 'Pizzaria Bella Napoli', city: 'São Paulo', score: 92 }],
          },
          {
            id: 'stage-contact',
            name: 'Contato',
            order: 1,
            totalCount: 1,
            hasMore: false,
            leads: [{ id: 'lead-3', companyName: 'Studio Aurora', city: 'Curitiba', score: 74 }],
          },
          {
            id: 'stage-won',
            name: 'Fechado',
            order: 2,
            totalCount: 0,
            hasMore: false,
            leads: [],
          },
        ],
      });
    }
    if (path.endsWith('/geo/regions')) return json(route, [{ code: 'SP', name: 'São Paulo' }]);
    if (path.endsWith('/geo/cities')) return json(route, [{ name: 'São Paulo' }]);
    if (path.endsWith('/searches/categories')) {
      return json(route, { plan: 'STARTER', availableCount: 5, categories: [] });
    }
    if (/\/searches\/[^/]+\/results$/.test(path)) {
      return json(route, {
        data: [
          {
            id: 'result-mobile',
            data: {
              externalId: 'node/1',
              companyName: 'Farmácia do Largo',
              category: 'pharmacy',
              city: 'São Paulo',
              state: 'SP',
              country: 'BR',
              phone: '(11) 99876-5432',
              email: 'info@farmacia.test',
              source: 'OPENSTREETMAP',
              websitePresence: 'NO_WEBSITE_REPORTED',
            },
            normalizedData: {
              externalId: 'node/1',
              companyName: 'Farmácia do Largo',
              category: 'pharmacy',
              city: 'São Paulo',
              state: 'SP',
              country: 'BR',
              phone: '(11) 99876-5432',
              email: 'info@farmacia.test',
              source: 'OPENSTREETMAP',
              websitePresence: 'NO_WEBSITE_REPORTED',
            },
            websitePresence: 'NO_WEBSITE_REPORTED',
            importedLeadId: null,
            createdAt: '2026-08-10T10:00:00.000Z',
          },
          {
            id: 'result-landline',
            data: {
              externalId: 'node/2',
              companyName: 'Cartório Central',
              category: 'notary',
              city: 'São Paulo',
              state: 'SP',
              country: 'BR',
              phone: '(11) 3234-5678',
              email: 'contato@cartorio.test',
              website: 'https://cartorio.test',
              source: 'OPENSTREETMAP',
              websitePresence: 'WEBSITE_FOUND',
            },
            normalizedData: {
              externalId: 'node/2',
              companyName: 'Cartório Central',
              category: 'notary',
              city: 'São Paulo',
              state: 'SP',
              country: 'BR',
              phone: '(11) 3234-5678',
              email: 'contato@cartorio.test',
              website: 'https://cartorio.test',
              source: 'OPENSTREETMAP',
              websitePresence: 'WEBSITE_FOUND',
            },
            websitePresence: 'WEBSITE_FOUND',
            importedLeadId: null,
            createdAt: '2026-08-10T10:00:00.000Z',
          },
          {
            id: 'result-nophone',
            data: {
              externalId: 'node/3',
              companyName: 'El Kabong Grill',
              category: 'restaurant',
              city: 'São Paulo',
              state: 'SP',
              country: 'BR',
              source: 'OPENSTREETMAP',
              websitePresence: 'WEBSITE_FOUND',
              website: 'https://kabong.test',
            },
            normalizedData: {
              externalId: 'node/3',
              companyName: 'El Kabong Grill',
              category: 'restaurant',
              city: 'São Paulo',
              state: 'SP',
              country: 'BR',
              source: 'OPENSTREETMAP',
              websitePresence: 'WEBSITE_FOUND',
              website: 'https://kabong.test',
            },
            websitePresence: 'WEBSITE_FOUND',
            importedLeadId: null,
            createdAt: '2026-08-10T10:00:00.000Z',
          },
        ],
        meta: { page: 1, pageSize: 20, total: 3, totalPages: 1 },
      });
    }
    if (/\/searches\/[^/]+$/.test(path) && !path.endsWith('/providers') && !path.endsWith('/categories')) {
      return json(route, {
        id: 'search-1',
        provider: 'OPENSTREETMAP',
        input: {
          categories: ['restaurant'],
          category: 'restaurant',
          city: 'São Paulo',
          state: 'SP',
          country: 'BR',
          onlyWithoutWebsite: false,
        },
        status: 'COMPLETED',
        createdAt: '2026-08-10T10:00:00.000Z',
        completedAt: '2026-08-10T10:01:00.000Z',
      });
    }
    if (path.endsWith('/searches') || path.endsWith('/imports') || path.endsWith('/tasks')) {
      if (path.endsWith('/searches')) {
        return json(route, {
          data: [
            {
              id: 'search-1',
              provider: 'OPENSTREETMAP',
              input: {
                categories: ['restaurant'],
                category: 'restaurant',
                city: 'São Paulo',
                state: 'SP',
                country: 'BR',
                onlyWithoutWebsite: false,
              },
              status: 'COMPLETED',
              createdAt: '2026-08-10T10:00:00.000Z',
              completedAt: '2026-08-10T10:01:00.000Z',
            },
          ],
          total: 1,
          meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        });
      }
      return json(route, { data: [], total: 0, meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    }
    if (path.endsWith('/campaigns') || path.endsWith('/workflows') || path.endsWith('/reports')) {
      return json(route, { data: [] });
    }
    return json(route, {});
  });
}

export async function openPrimaryNav(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('button', { name: /abrir menu|open menu/i }).click();
  }
  return page.getByLabel(/navegação principal|main navigation/i);
}

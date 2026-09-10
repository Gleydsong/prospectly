import { expect, test } from '@playwright/test';

test.describe('Milestone 1 UI/UX Refinements (#183-#194)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      console.log('--- BROWSER PAGE ERROR ---', err.stack || err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('--- BROWSER CONSOLE ERROR ---', msg.text());
      }
    });

    // Authenticated state
    await page.addInitScript(() => {
      localStorage.setItem(
        'prospectly-auth',
        JSON.stringify({
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
        }),
      );
    });

    // Mock generic API routes
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const json = (body: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });

      if (path.endsWith('/auth/refresh')) return json({ accessToken: 'e2e-token' });
      if (path.endsWith('/users/me'))
        return json({ name: 'Guia Teste', emailVerifiedAt: '2026-08-12T10:00:00.000Z' });
      if (path.endsWith('/billing/current') || path.endsWith('/billing/status'))
        return json({
          creditBalance: 15,
          plan: 'STARTER',
          status: 'ACTIVE',
          searchUsage: { used: 5, limit: 50, remaining: 45, unlimited: false },
        });
      if (path.endsWith('/geo/regions')) return json([{ code: 'SP', name: 'São Paulo' }]);
      if (path.endsWith('/geo/cities')) return json([{ name: 'São Paulo' }]);

      if (path.endsWith('/searches/categories')) {
        return json({
          plan: 'STARTER',
          availableCount: 5,
          categories: [
            { id: 'restaurant', name: 'Restaurantes', available: true },
            { id: 'dentist', name: 'Dentistas', available: true },
            { id: 'bar', name: 'Bares', available: true },
            { id: 'hotel', name: 'Hotéis', available: true },
            { id: 'gym', name: 'Academias', available: true },
            { id: 'construction', name: 'Construção', available: false },
          ],
        });
      }

      if (path.endsWith('/searches')) {
        return json({ data: [], total: 0, page: 1, pageSize: 20 });
      }

      if (path.endsWith('/dashboard/summary')) {
        return json({
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

      if (path.endsWith('/custom-fields')) {
        return json([
          {
            id: 'custom-1',
            name: 'Segmento Específico',
            type: 'text',
            position: 0,
            archivedAt: null,
            options: [],
          },
        ]);
      }

      if (path.endsWith('/pipelines/board')) {
        return json({
          pipeline: { id: 'pipe-1', name: 'Funil Principal' },
          limit: 50,
          offset: 0,
          stages: [
            {
              id: 'stage-new',
              name: 'Novos',
              order: 0,
              color: '#3b82f6',
              totalCount: 3,
              hasMore: false,
              leads: [
                {
                  id: 'lead-1',
                  companyName: 'Clínica Odonto Vida',
                  city: 'São Paulo',
                  score: 85,
                  phone: '+5511999999999',
                },
              ],
            },
            {
              id: 'stage-qual',
              name: 'Qualificados',
              order: 1,
              color: '#10b981',
              totalCount: 7,
              hasMore: false,
              leads: [
                {
                  id: 'lead-2',
                  companyName: 'Pizzaria Bella Napoli',
                  city: 'São Paulo',
                  score: 92,
                  phone: '+5511988888888',
                },
              ],
            },
            {
              id: 'stage-won',
              name: 'Ganhos',
              order: 2,
              color: '#22c55e',
              totalCount: 2,
              hasMore: false,
              leads: [],
            },
          ],
        });
      }

      if (path.endsWith('/pipelines')) {
        return json([
          {
            id: 'pipe-1',
            name: 'Funil Principal',
            isDefault: true,
            stages: [
              { id: 'stage-new', name: 'Novos', order: 0, color: '#3b82f6' },
              { id: 'stage-qual', name: 'Qualificados', order: 1, color: '#10b981' },
              { id: 'stage-won', name: 'Ganhos', order: 2, color: '#22c55e' },
            ],
          },
        ]);
      }

      if (path.match(/\/leads\/lead-1$/)) {
        return json({
          id: 'lead-1',
          companyName: 'Clínica Odonto Vida',
          city: 'São Paulo',
          state: 'SP',
          country: 'BR',
          category: 'dentist',
          segment: 'Saúde Odontológica',
          status: 'QUALIFIED',
          stage: null,
          score: 85,
          website: null,
          phone: '+5511999999999',
          email: 'contato@odontovida.com.br',
          address: 'Rua Augusta, 100',
          doNotContact: false,
          source: 'GOOGLE_PLACES',
          createdAt: '2026-08-10T10:00:00.000Z',
          updatedAt: '2026-08-10T10:00:00.000Z',
          activities: [],
          tags: [],
        });
      }

      if (path.match(/\/leads\/lead-2$/)) {
        return json({
          id: 'lead-2',
          companyName: 'Pizzaria Bella Napoli',
          city: 'São Paulo',
          state: 'SP',
          country: 'BR',
          category: 'restaurant',
          segment: 'Gastronomia',
          status: 'NEW',
          stage: null,
          score: 92,
          website: null,
          phone: '+5511988888888',
          email: null,
          address: 'Rua Bela Cintra, 200',
          doNotContact: false,
          source: 'GOOGLE_PLACES',
          createdAt: '2026-08-10T10:00:00.000Z',
          updatedAt: '2026-08-10T10:00:00.000Z',
          activities: [],
          tags: [],
        });
      }

      if (path.match(/\/leads\/[^/]+\/activities/)) {
        return json([]);
      }

      if (path.endsWith('/leads')) {
        return json({
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
              phone: '+5511999999999',
              createdAt: '2026-08-10T10:00:00.000Z',
              updatedAt: '2026-08-10T10:00:00.000Z',
            },
            {
              id: 'lead-2',
              companyName: 'Pizzaria Bella Napoli',
              city: 'São Paulo',
              state: 'SP',
              category: 'clothes',
              segment: 'clothes',
              status: 'NEW',
              score: 92,
              phone: '+5511988888888',
              createdAt: '2026-08-10T10:00:00.000Z',
              updatedAt: '2026-08-10T10:00:00.000Z',
            },
          ],
          total: 2,
          page: 1,
          pageSize: 20,
        });
      }

      if (path.endsWith('/tasks')) {
        const todayIso = new Date().toISOString();
        const yesterdayIso = new Date(Date.now() - 86400000).toISOString();
        return json({
          data: [
            {
              id: 'task-1',
              title: 'Ligar para confirmar proposta',
              priority: 'HIGH',
              status: 'PENDING',
              dueAt: todayIso,
              lead: { id: 'lead-1', companyName: 'Clínica Odonto Vida' },
            },
            {
              id: 'task-2',
              title: 'Enviar cardápio atualizado',
              priority: 'URGENT',
              status: 'PENDING',
              dueAt: yesterdayIso,
              lead: { id: 'lead-2', companyName: 'Pizzaria Bella Napoli' },
            },
            {
              id: 'task-3',
              title: 'Primeiro contato realizado',
              priority: 'LOW',
              status: 'DONE',
              dueAt: yesterdayIso,
              lead: { id: 'lead-1', companyName: 'Clínica Odonto Vida' },
            },
          ],
          meta: { page: 1, pageSize: 15, total: 3, totalPages: 1 },
        });
      }

      if (path.endsWith('/imports')) {
        return json({ data: [], total: 0 });
      }

      if (path.endsWith('/views')) {
        return json([]);
      }

      if (path.match(/\/leads\/[^/]+\/activities/)) {
        return json({ data: [], total: 0 });
      }

      if (path.endsWith('/tags')) {
        return json([]);
      }

      return json({});
    });
  });

  test('#183 & #191: TopNav renders "Assistentes" label and displays credit balance', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');

    if (isMobile) {
      // On mobile, open drawer or check footer
      await page.getByRole('button', { name: /Abrir menu|Abrir navegação/i }).click();
      await expect(page.locator('#mobile-nav').getByRole('link', { name: /Assistentes/i }).first()).toBeVisible();
    } else {
      // On desktop, TopNav has 'Assistentes' navigation link
      const agentsNav = page.getByLabel('Navegação principal').getByRole('link', { name: /Assistentes/i });
      await expect(agentsNav).toBeVisible();
      await expect(agentsNav).toHaveAttribute('href', '/agents');
    }

    if (!isMobile) {
      // Credit counter renders in desktop TopNav
      await expect(page.getByText('15 créditos')).toBeVisible();
    }
  });

  test('#185: Dashboard translates raw category keys in recent leads table', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByText('Pizzaria Bella Napoli')).toBeVisible();
    // 'clothes' raw technical key is formatted via formatCategoryTag to 'Loja de roupas'
    await expect(page.getByText('Loja de roupas')).toBeVisible();
  });

  test('#186 & #192: Search page shows city placeholder and clear distinction between credits and unlocked niches', async ({
    page,
  }) => {
    await page.goto('/search');

    // #186: Placeholder should be "Selecione o estado" before selecting state
    const citySelect = page.getByLabel('Cidade');
    await expect(citySelect).toContainText('Selecione o estado');

    // #192: Distinct message informing that credits can be used on unlocked niches
    await expect(
      page.getByText(/Seus 15 créditos podem ser usados nos nichos liberados/i),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Desbloquear todos os nichos →' }),
    ).toBeVisible();
  });

  test('#188 & #189: Leads page compact filter layout and "Personalizado" badge in column selector', async ({
    page,
  }) => {
    await page.goto('/leads');

    // #188: Secondary filters present
    await expect(page.getByLabel('Último contato')).toBeVisible();

    // #189: Column selector displays 'Personalizado' badge for custom fields
    await expect(page.getByRole('checkbox', { name: 'Segmento Específico' })).toBeVisible();
    await expect(page.getByText('Personalizado')).toBeVisible();
  });

  test('#184 & #187: Lead Detail Stepper syncs with lead status and pitch adapts dynamically to category', async ({
    page,
  }) => {
    // 1. Health / dentist lead: status is QUALIFIED, stage is null
    await page.goto('/leads/lead-1');

    // #187: Stepper highlights "Qualificados"
    const qualStep = page.getByRole('button', { name: /Qualificados/i });
    await expect(qualStep).toBeVisible();
    await expect(qualStep).toHaveAttribute('aria-current', 'step');

    // #184: Dynamic website gap pitch mentions appointment scheduling for dentists
    await expect(
      page.getByText(/Sem site cadastrado — argumento comercial para ofertar agendamento online ou catálogo de serviços em São Paulo\./i),
    ).toBeVisible();

    // 2. Restaurant lead: status is NEW
    await page.goto('/leads/lead-2');

    // #187: Stepper highlights "Novos"
    const newStep = page.getByRole('button', { name: /Novos/i });
    await expect(newStep).toBeVisible();
    await expect(newStep).toHaveAttribute('aria-current', 'step');

    // #184: Dynamic website gap pitch mentions digital menu / online orders for restaurants
    await expect(
      page.getByText(/Sem site cadastrado — argumento comercial para ofertar cardápio digital ou pedidos online em São Paulo\./i),
    ).toBeVisible();
  });

  test('#193: Funil / Pipeline Kanban displays scroll buttons and column counters', async ({
    page,
  }) => {
    await page.goto('/pipeline');

    // Left and Right scroll buttons exist in header
    const scrollLeftBtn = page.getByRole('button', {
      name: 'Rolar colunas para a esquerda',
    });
    const scrollRightBtn = page.getByRole('button', {
      name: 'Rolar colunas para a direita',
    });

    await expect(scrollLeftBtn).toBeVisible();
    await expect(scrollRightBtn).toBeVisible();

    // Test clicking the scroll buttons without error
    await scrollRightBtn.click();
    await scrollLeftBtn.click();

    // Counters exist on each stage header
    await expect(page.getByTitle('3 leads nesta etapa')).toBeVisible();
    await expect(page.getByTitle('7 leads nesta etapa')).toBeVisible();
    await expect(page.getByTitle('2 leads nesta etapa')).toBeVisible();
  });

  test('#190: Imports page allows downloading CSV template', async ({ page }) => {
    await page.goto('/imports');

    const downloadBtn = page.getByRole('button', { name: /Baixar modelo CSV/i });
    await expect(downloadBtn).toBeVisible();

    // Verify download triggers and has correct filename
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('modelo-leads-prospectly.csv');
  });

  test('#194: Tasks page provides search filtering and quick filter chips', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/tasks');

    // Verify search and quick chips rendered
    const searchInput = page.getByLabel('Buscar tarefas');
    await expect(searchInput).toBeVisible();

    const chipAll = page.getByRole('button', { name: 'Todas' });
    const chipToday = page.getByRole('button', { name: 'Hoje' });
    const chipOverdue = page.getByRole('button', { name: 'Atrasadas' });
    const chipDone = page.getByRole('button', { name: 'Concluídas' });

    await expect(chipAll).toBeVisible();
    await expect(chipToday).toBeVisible();
    await expect(chipOverdue).toBeVisible();
    await expect(chipDone).toBeVisible();

    // Helper locator that looks in table on desktop and in list on mobile
    const taskContainer = isMobile ? page.locator('ul.divide-y') : page.locator('tbody');

    // All 3 tasks initially visible
    await expect(taskContainer.getByText('Ligar para confirmar proposta')).toBeVisible();
    await expect(taskContainer.getByText('Enviar cardápio atualizado')).toBeVisible();
    await expect(taskContainer.getByText('Primeiro contato realizado')).toBeVisible();

    // Filter by search: "cardápio"
    await searchInput.fill('cardápio');
    await expect(taskContainer.getByText('Enviar cardápio atualizado')).toBeVisible();
    await expect(taskContainer.getByText('Ligar para confirmar proposta')).not.toBeVisible();
    await expect(taskContainer.getByText('Primeiro contato realizado')).not.toBeVisible();

    // Clear search
    await searchInput.fill('');

    // Filter by Quick Chip: "Hoje" (only task-1 is due today)
    await chipToday.click();
    await expect(taskContainer.getByText('Ligar para confirmar proposta')).toBeVisible();
    await expect(taskContainer.getByText('Enviar cardápio atualizado')).not.toBeVisible();
    await expect(taskContainer.getByText('Primeiro contato realizado')).not.toBeVisible();

    // Filter by Quick Chip: "Atrasadas" (task-2 is overdue, task-3 is done so not overdue)
    await chipOverdue.click();
    await expect(taskContainer.getByText('Enviar cardápio atualizado')).toBeVisible();
    await expect(taskContainer.getByText('Ligar para confirmar proposta')).not.toBeVisible();
    await expect(taskContainer.getByText('Primeiro contato realizado')).not.toBeVisible();

    // Filter by Quick Chip: "Concluídas" (only task-3 is done)
    await chipDone.click();
    await expect(taskContainer.getByText('Primeiro contato realizado')).toBeVisible();
    await expect(taskContainer.getByText('Ligar para confirmar proposta')).not.toBeVisible();
    await expect(taskContainer.getByText('Enviar cardápio atualizado')).not.toBeVisible();

    // Empty state when search matches nothing
    await chipAll.click();
    await searchInput.fill('termo inexistente abcxyz');
    await expect(page.getByText('Nenhuma tarefa encontrada')).toBeVisible();
    await expect(page.getByText('Tente ajustar a busca ou os filtros selecionados.')).toBeVisible();
  });
});

# Geo Selectors Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Encadear selects País → Região → Cidade no SearchPage, com dados servidos pela API para todos os países de prospecting.

**Architecture:** Novo módulo Nest `geo` encapsula `country-state-city`. Endpoints `GET /geo/regions` e `GET /geo/cities`. Web consome via React Query e liga os selects no formulário existente.

**Tech Stack:** NestJS, class-validator, country-state-city, Jest (API), React Hook Form + Vitest (web)

## Global Constraints

- País deve estar em `PROSPECTING_COUNTRY_CODES`
- Sem texto livre para cidade/região no formulário de search
- Manter payload de create search (`city` nome, `state` código ou nome de região conforme retorno da API — preferir `code` para região quando existir, `name` para cidade)
- Documentar progresso em `.superpowers/sdd/` a cada task
- Unit + integration/e2e obrigatórios

---

### Task 1: GeoService + unit tests

**Files:**
- Create: `apps/api/src/modules/geo/geo.service.ts`
- Create: `apps/api/src/modules/geo/geo.service.spec.ts`
- Create: `apps/api/src/modules/geo/geo.module.ts`
- Modify: `apps/api/package.json` (dependência `country-state-city`)

- [ ] Install `country-state-city`
- [ ] Implement `listRegions(country)` / `listCities(country, regionCode)`
- [ ] Reject unsupported countries
- [ ] Unit tests BR + PT + invalid
- [ ] Update `.superpowers/sdd/progress.md`

### Task 2: GeoController + HTTP integration

**Files:**
- Create: `apps/api/src/modules/geo/geo.controller.ts`
- Create: `apps/api/src/modules/geo/dto/query-regions.dto.ts`
- Create: `apps/api/src/modules/geo/dto/query-cities.dto.ts`
- Create: `apps/api/src/modules/geo/geo.integration.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] Wire module
- [ ] Integration tests 200/400
- [ ] Update progress docs

### Task 3: Web hooks + SearchPage cascade

**Files:**
- Modify: `apps/web/src/features/prospecting/api.ts`
- Modify: `apps/web/src/features/prospecting/hooks.ts`
- Modify: `apps/web/src/pages/search-page.tsx`
- Modify: `apps/web/src/pages/search-page.test.tsx`
- Create/Modify: hooks tests

- [ ] Fetch regions/cities
- [ ] Replace city Input and free region Input with Selects
- [ ] Tests for cascade PT
- [ ] Update progress docs

### Task 4: Verify + final docs

- [ ] Run API + web tests for geo/search
- [ ] Write `.superpowers/sdd/task-geo-selectors-report.md`
- [ ] Commit if requested

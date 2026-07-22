# Fase 3 Prospecting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encontrar empresas brasileiras sem website via OpenStreetMap, importar resultados selecionados e importar CSV de leads com jobs BullMQ persistidos.

**Architecture:** Novos módulos NestJS `prospecting` e `imports` usam BullMQ/Redis e um serviço compartilhado de ingestão de leads. Nominatim resolve município/UF e Overpass busca estabelecimentos; provider fica atrás de interface testável. React acompanha pesquisas e importações via polling, sem WebSocket.

**Tech Stack:** NestJS 10, TypeScript, Prisma 6, PostgreSQL, BullMQ, Redis, React 18, TanStack Query, React Hook Form, Zod, Jest, Testing Library.

## Global Constraints

- Brasil inteiro; entrada obrigatória `category`, `city` e uma das 27 UFs.
- OpenStreetMap é único provider desta fase; endpoints Nominatim e Overpass configuráveis.
- Ausência de website significa `NO_WEBSITE_REPORTED`, nunca confirmação absoluta.
- Processamento de pesquisa e CSV é assíncrono com BullMQ e Redis.
- `organizationId` e usuário vêm somente do JWT; recursos entre organizações retornam `404`.
- Pesquisa e resultados paginados; somente resultados da organização podem ser importados.
- CSV aceita `,` ou `;`, UTF-8 BOM e importação parcial; nunca executa fórmulas.
- Nenhum teste acessa internet; clientes HTTP e filas são mockados.
- TDD obrigatório: cada comportamento nasce em teste falhando, seguido da menor implementação.
- Nenhum refactor fora do escopo da Fase 3.

---

## File Map

- `apps/api/prisma/schema.prisma`: estados e campos persistidos da Fase 3.
- `apps/api/src/modules/leads/lead-ingestion.service.ts`: normalização, deduplicação e criação compartilhada.
- `apps/api/src/modules/prospecting/`: contrato, provider OSM, DTOs, serviço, controller, fila e processor.
- `apps/api/src/modules/imports/`: parser CSV, DTOs, serviço, controller, fila e processor.
- `apps/web/src/features/prospecting/`: contratos HTTP e hooks de polling.
- `apps/web/src/features/imports/`: contratos HTTP e hooks de importação CSV.
- `apps/web/src/pages/search-page.tsx`: experiência de pesquisa e importação seletiva.
- `apps/web/src/pages/imports-page.tsx`: experiência CSV.

### Task 1: Persistência e ingestão compartilhada de leads

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_phase_3_prospecting/migration.sql`
- Create: `apps/api/src/modules/leads/lead-ingestion.service.ts`
- Create: `apps/api/src/modules/leads/lead-ingestion.service.spec.ts`
- Modify: `apps/api/src/modules/leads/leads.module.ts`
- Modify: `apps/api/src/modules/leads/leads.service.ts`
- Modify: `apps/api/src/modules/leads/dto/create-lead.dto.ts`

**Interfaces:**
- Produces: `WebsitePresence`, `SearchStatus.PROCESSING`, unique external identities.
- Produces: `LeadIngestionService.ingest(organizationId, actorId, candidate): Promise<LeadIngestionResult>`.
- `LeadIngestionResult.status` is `IMPORTED | DUPLICATE | POSSIBLE_DUPLICATE`.

- [ ] Write failing tests for Brazilian phone normalization, external-ID duplicate, email/domain duplicate, probable name-city-UF duplicate, tag creation and `TO_REVIEW` defaults.
- [ ] Run `pnpm --filter @prospectly/api test -- lead-ingestion.service.spec.ts --runInBand`; confirm failures come from missing service.
- [ ] Add Prisma enum/fields/constraints and migration SQL matching the schema exactly.
- [ ] Implement `LeadIngestionService`; keep normalization helpers deterministic and exported only when tests need direct access.
- [ ] Route existing single-lead creation through shared ingestion without changing manual-create response behavior.
- [ ] Run focused tests, Prisma generate, API typecheck and existing lead tests.

### Task 2: OpenStreetMap provider

**Files:**
- Create: `apps/api/src/modules/prospecting/domain/search-provider.ts`
- Create: `apps/api/src/modules/prospecting/domain/normalized-business.ts`
- Create: `apps/api/src/modules/prospecting/infrastructure/osm-category-map.ts`
- Create: `apps/api/src/modules/prospecting/infrastructure/openstreetmap.provider.ts`
- Create: `apps/api/src/modules/prospecting/infrastructure/openstreetmap.provider.spec.ts`
- Modify: `apps/api/src/config/configuration.ts`
- Modify: `apps/api/src/config/validation.ts`
- Modify: `apps/api/.env.example`

**Interfaces:**
- Consumes: `WebsitePresence` from Prisma.
- Produces: `SearchProvider.search(input): Promise<NormalizedBusiness[]>`.
- Provider token: `OPENSTREETMAP_SEARCH_PROVIDER`.

- [ ] Write failing tests for UF validation, category-to-OSM tag mapping, Nominatim municipality selection, Overpass query escaping, website tag precedence and normalized Brazilian output.
- [ ] Run focused provider test and confirm expected failures.
- [ ] Implement typed HTTP client with native `fetch`, abort timeout and sanitized provider errors.
- [ ] Implement category mapping across `amenity`, `shop`, `craft`, `office`, `tourism`; reject unsupported empty category.
- [ ] Implement Nominatim lookup restricted to `countrycodes=br`, validate returned UF, then Overpass area query.
- [ ] Prefer `website`, then `contact:website`, then `url`; set presence accordingly.
- [ ] Add configurable URLs, user agent, timeout and result cap to config/env validation.
- [ ] Run focused tests and API typecheck.

### Task 3: Pesquisa assíncrona e importação seletiva

**Files:**
- Create: `apps/api/src/modules/prospecting/dto/create-search.dto.ts`
- Create: `apps/api/src/modules/prospecting/dto/query-searches.dto.ts`
- Create: `apps/api/src/modules/prospecting/dto/import-search-results.dto.ts`
- Create: `apps/api/src/modules/prospecting/prospecting.constants.ts`
- Create: `apps/api/src/modules/prospecting/prospecting.service.ts`
- Create: `apps/api/src/modules/prospecting/prospecting.service.spec.ts`
- Create: `apps/api/src/modules/prospecting/prospecting.processor.ts`
- Create: `apps/api/src/modules/prospecting/prospecting.controller.ts`
- Create: `apps/api/src/modules/prospecting/prospecting.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Endpoints: `POST /searches`, `GET /searches`, `GET /searches/:id`, `GET /searches/:id/results`, `POST /searches/:id/import`.
- Queue: `prospecting`; job: `run-search`; `jobId = search.id`.
- Consumes `SearchProvider` and `LeadIngestionService`.

- [ ] Write failing service tests for `PENDING` creation, queue payload, ownership filtering, state transitions, idempotent result persistence and selective import.
- [ ] Run focused test and confirm expected failures.
- [ ] Add BullMQ dependencies and root Redis connection from `REDIS_URL`.
- [ ] Implement validated DTOs, service, processor and controller with roles `OWNER`, `ADMIN`, `SALES`, `MEMBER` for writes.
- [ ] Processor changes `PENDING` to `PROCESSING`, replaces/upserts results, then completes or records sanitized failure.
- [ ] Selective import validates all IDs belong to search and organization, calls ingestion, links imported leads and returns counters/conflicts.
- [ ] Add pagination using existing `PaginationQueryDto` conventions.
- [ ] Run focused tests, API typecheck and API build.

### Task 4: CSV preview and asynchronous import

**Files:**
- Create: `apps/api/src/modules/imports/csv-parser.service.ts`
- Create: `apps/api/src/modules/imports/csv-parser.service.spec.ts`
- Create: `apps/api/src/modules/imports/dto/create-csv-import.dto.ts`
- Create: `apps/api/src/modules/imports/dto/query-imports.dto.ts`
- Create: `apps/api/src/modules/imports/imports.constants.ts`
- Create: `apps/api/src/modules/imports/imports.service.ts`
- Create: `apps/api/src/modules/imports/imports.service.spec.ts`
- Create: `apps/api/src/modules/imports/imports.processor.ts`
- Create: `apps/api/src/modules/imports/imports.controller.ts`
- Create: `apps/api/src/modules/imports/imports.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Endpoints: `POST /imports/csv/preview`, `POST /imports/csv`, `GET /imports`, `GET /imports/:id`, `GET /imports/:id/errors`.
- Queue: `imports`; job: `process-csv-import`; payload stores import ID plus safe staged content needed by worker.
- Consumes `LeadIngestionService`.

- [ ] Write failing parser tests for comma, semicolon, quoted delimiter, escaped quotes, BOM, headers, blank lines and malformed rows.
- [ ] Run parser test and confirm expected failures.
- [ ] Add a maintained CSV parser dependency rather than hand-writing RFC parsing; configure upload memory limits.
- [ ] Implement preview returning headers, first five rows and deterministic mapping suggestions.
- [ ] Write failing service tests for tenant isolation, counters, partial success, `ImportError`, duplicates and failed status.
- [ ] Implement import record, queue job, processor and paginated endpoints.
- [ ] Validate mapping keys against an allowlist and require `companyName` mapping.
- [ ] Run import tests, API typecheck and API build.

### Task 5: Web research workflow

**Files:**
- Create: `apps/web/src/features/prospecting/api.ts`
- Create: `apps/web/src/features/prospecting/hooks.ts`
- Create: `apps/web/src/features/prospecting/hooks.test.tsx`
- Rewrite: `apps/web/src/pages/search-page.tsx`
- Create: `apps/web/src/pages/search-page.test.tsx`
- Modify: `apps/web/src/types/index.ts`

**Interfaces:**
- Consumes Task 3 endpoints and paginated contracts.
- Poll every 2 seconds only for `PENDING | PROCESSING`; stop for terminal states.

- [ ] Write failing tests for required category/city/UF, default no-site filter, search submission and API errors.
- [ ] Write failing hook test proving polling starts/stops by status.
- [ ] Implement typed API and hooks.
- [ ] Implement form, history/status, result table, pagination, individual/select-all controls and import summary.
- [ ] Disable already-imported rows and preserve selection only for current result page.
- [ ] Add accessible labels, keyboard behavior and loading/error/empty states.
- [ ] Run focused web tests, web typecheck and web build.

### Task 6: Web CSV workflow

**Files:**
- Create: `apps/web/src/features/imports/api.ts`
- Create: `apps/web/src/features/imports/hooks.ts`
- Create: `apps/web/src/pages/imports-page.tsx`
- Create: `apps/web/src/pages/imports-page.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/layout/sidebar.tsx`
- Modify: `apps/web/src/types/index.ts`

**Interfaces:**
- Consumes Task 4 endpoints.
- Poll every 2 seconds for `PENDING | PROCESSING` and stop at terminal status.

- [ ] Write failing UI tests for CSV-only selection, preview, required company mapping, confirmation, progress and row errors.
- [ ] Implement multipart preview/create APIs and typed hooks.
- [ ] Implement upload, five-row preview, mapping selects, confirmation and progress summary.
- [ ] Add imports route and sidebar entry.
- [ ] Ensure file input resets only after successful job creation.
- [ ] Run focused web tests, web typecheck and web build.

### Task 7: Cross-module security and integration verification

**Files:**
- Create: `apps/api/src/modules/prospecting/prospecting.integration.spec.ts`
- Create: `apps/api/src/modules/imports/imports.integration.spec.ts`
- Modify: `README.md`
- Modify: `docker-compose.yml` only if worker configuration requires it.

**Interfaces:**
- Validates Tasks 1–6 as one release.

- [ ] Write integration tests with mocked provider/queues for organization isolation, forbidden roles, invalid UUIDs, duplicate imports and sanitized provider failures.
- [ ] Run tests and confirm failures expose missing integration behavior, not test setup errors.
- [ ] Fix only integration defects uncovered by tests.
- [ ] Document OpenStreetMap setup, Redis requirement, env vars, API flow, CSV format and public-service usage limitations.
- [ ] Run Prisma validation and generate.
- [ ] Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`; record exact totals and failures.
- [ ] Inspect final diff/file list for secrets, generated build output and unrelated changes.

## Execution Order

1. Task 1 establishes schema and shared ingestion.
2. Tasks 2 and 4 parser work can proceed in parallel after Task 1 interfaces settle.
3. Task 3 integrates provider, queue and ingestion.
4. Task 4 completes CSV backend.
5. Tasks 5 and 6 can proceed in parallel after their API contracts exist.
6. Task 7 performs broad security and release verification.

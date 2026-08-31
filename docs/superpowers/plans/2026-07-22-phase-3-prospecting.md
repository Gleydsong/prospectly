# Plano de implementação Fase 3 Prospecting

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa a tarefa. Passos usam sintaxe de checkbox (`- [ ]`) para rastreamento.

**Objetivo:** Encontrar empresas brasileiras sem website via OpenStreetMap, importar resultados selecionados e importar CSV de leads com jobs BullMQ persistidos.

**Arquitetura:** Novos módulos NestJS `prospecting` e `imports` usam BullMQ/Redis e um serviço compartilhado de ingestão de leads. Nominatim resolve município/UF e Overpass busca estabelecimentos; provider fica atrás de interface testável. React acompanha pesquisas e importações via polling, sem WebSocket.

**Stack:** NestJS 10, TypeScript, Prisma 6, PostgreSQL, BullMQ, Redis, React 18, TanStack Query, React Hook Form, Zod, Jest, Testing Library.

## Restrições globais

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

## Mapa de arquivos

- `apps/api/prisma/schema.prisma`: estados e campos persistidos da Fase 3.
- `apps/api/src/modules/leads/lead-ingestion.service.ts`: normalização, deduplicação e criação compartilhada.
- `apps/api/src/modules/prospecting/`: contrato, provider OSM, DTOs, serviço, controller, fila e processor.
- `apps/api/src/modules/imports/`: parser CSV, DTOs, serviço, controller, fila e processor.
- `apps/web/src/features/prospecting/`: contratos HTTP e hooks de polling.
- `apps/web/src/features/imports/`: contratos HTTP e hooks de importação CSV.
- `apps/web/src/pages/search-page.tsx`: experiência de pesquisa e importação seletiva.
- `apps/web/src/pages/imports-page.tsx`: experiência CSV.

### Task 1: Persistência e ingestão compartilhada de leads

**Arquivos:**
- Modificar: `apps/api/prisma/schema.prisma`
- Criar: `apps/api/prisma/migrations/<timestamp>_phase_3_prospecting/migration.sql`
- Criar: `apps/api/src/modules/leads/lead-ingestion.service.ts`
- Criar: `apps/api/src/modules/leads/lead-ingestion.service.spec.ts`
- Modificar: `apps/api/src/modules/leads/leads.module.ts`
- Modificar: `apps/api/src/modules/leads/leads.service.ts`
- Modificar: `apps/api/src/modules/leads/dto/create-lead.dto.ts`

**Interfaces:**
- Produz: `WebsitePresence`, `SearchStatus.PROCESSING`, identidades externas únicas.
- Produz: `LeadIngestionService.ingest(organizationId, actorId, candidate): Promise<LeadIngestionResult>`.
- `LeadIngestionResult.status` é `IMPORTED | DUPLICATE | POSSIBLE_DUPLICATE`.

- [ ] Escrever testes falhando para normalização de telefone BR, duplicata por external-ID, duplicata email/domínio, duplicata provável nome-cidade-UF, criação de tag e defaults `TO_REVIEW`.
- [ ] Executar `pnpm --filter @prospectly/api test -- lead-ingestion.service.spec.ts --runInBand`; confirmar falhas por service ausente.
- [ ] Adicionar enum/campos/constraints Prisma e SQL de migration alinhados ao schema exato.
- [ ] Implementar `LeadIngestionService`; manter helpers de normalização determinísticos e exportados só quando testes precisarem de acesso direto.
- [ ] Rotear criação single-lead existente pela ingestão compartilhada sem alterar comportamento de resposta do create manual.
- [ ] Executar testes focados, Prisma generate, typecheck API e testes de leads existentes.

### Task 2: Provider OpenStreetMap

**Arquivos:**
- Criar: `apps/api/src/modules/prospecting/domain/search-provider.ts`
- Criar: `apps/api/src/modules/prospecting/domain/normalized-business.ts`
- Criar: `apps/api/src/modules/prospecting/infrastructure/osm-category-map.ts`
- Criar: `apps/api/src/modules/prospecting/infrastructure/openstreetmap.provider.ts`
- Criar: `apps/api/src/modules/prospecting/infrastructure/openstreetmap.provider.spec.ts`
- Modificar: `apps/api/src/config/configuration.ts`
- Modificar: `apps/api/src/config/validation.ts`
- Modificar: `apps/api/.env.example`

**Interfaces:**
- Consome: `WebsitePresence` do Prisma.
- Produz: `SearchProvider.search(input): Promise<NormalizedBusiness[]>`.
- Token do provider: `OPENSTREETMAP_SEARCH_PROVIDER`.

- [ ] Escrever testes falhando para validação de UF, mapeamento categoria→tag OSM, seleção de município Nominatim, escape de query Overpass, precedência de tag website e saída BR normalizada.
- [ ] Executar teste focado do provider e confirmar falhas esperadas.
- [ ] Implementar client HTTP tipado com `fetch` nativo, timeout abort e erros de provider sanitizados.
- [ ] Implementar mapeamento de categoria em `amenity`, `shop`, `craft`, `office`, `tourism`; rejeitar categoria vazia não suportada.
- [ ] Implementar lookup Nominatim restrito a `countrycodes=br`, validar UF retornada, depois query de área Overpass.
- [ ] Preferir `website`, depois `contact:website`, depois `url`; definir presence conforme.
- [ ] Adicionar URLs configuráveis, user agent, timeout e cap de resultados em config/validação env.
- [ ] Executar testes focados e typecheck API.

### Task 3: Pesquisa assíncrona e importação seletiva

**Arquivos:**
- Criar: `apps/api/src/modules/prospecting/dto/create-search.dto.ts`
- Criar: `apps/api/src/modules/prospecting/dto/query-searches.dto.ts`
- Criar: `apps/api/src/modules/prospecting/dto/import-search-results.dto.ts`
- Criar: `apps/api/src/modules/prospecting/prospecting.constants.ts`
- Criar: `apps/api/src/modules/prospecting/prospecting.service.ts`
- Criar: `apps/api/src/modules/prospecting/prospecting.service.spec.ts`
- Criar: `apps/api/src/modules/prospecting/prospecting.processor.ts`
- Criar: `apps/api/src/modules/prospecting/prospecting.controller.ts`
- Criar: `apps/api/src/modules/prospecting/prospecting.module.ts`
- Modificar: `apps/api/src/app.module.ts`
- Modificar: `apps/api/package.json`

**Interfaces:**
- Endpoints: `POST /searches`, `GET /searches`, `GET /searches/:id`, `GET /searches/:id/results`, `POST /searches/:id/import`.
- Fila: `prospecting`; job: `run-search`; `jobId = search.id`.
- Consome `SearchProvider` e `LeadIngestionService`.

- [ ] Escrever testes falhando de service para criação `PENDING`, payload de fila, filtro de ownership, transições de estado, persistência idempotente de resultados e importação seletiva.
- [ ] Executar teste focado e confirmar falhas esperadas.
- [ ] Adicionar deps BullMQ e conexão Redis root a partir de `REDIS_URL`.
- [ ] Implementar DTOs validados, service, processor e controller com roles `OWNER`, `ADMIN`, `SALES`, `MEMBER` para writes.
- [ ] Processor muda `PENDING` para `PROCESSING`, substitui/upserta resultados, depois completa ou registra falha sanitizada.
- [ ] Importação seletiva valida que todos IDs pertencem à search e organização, chama ingestão, liga leads importados e retorna contadores/conflitos.
- [ ] Adicionar paginação usando convenções existentes de `PaginationQueryDto`.
- [ ] Executar testes focados, typecheck API e build API.

### Task 4: Preview CSV e importação assíncrona

**Arquivos:**
- Criar: `apps/api/src/modules/imports/csv-parser.service.ts`
- Criar: `apps/api/src/modules/imports/csv-parser.service.spec.ts`
- Criar: `apps/api/src/modules/imports/dto/create-csv-import.dto.ts`
- Criar: `apps/api/src/modules/imports/dto/query-imports.dto.ts`
- Criar: `apps/api/src/modules/imports/imports.constants.ts`
- Criar: `apps/api/src/modules/imports/imports.service.ts`
- Criar: `apps/api/src/modules/imports/imports.service.spec.ts`
- Criar: `apps/api/src/modules/imports/imports.processor.ts`
- Criar: `apps/api/src/modules/imports/imports.controller.ts`
- Criar: `apps/api/src/modules/imports/imports.module.ts`
- Modificar: `apps/api/src/app.module.ts`
- Modificar: `apps/api/package.json`

**Interfaces:**
- Endpoints: `POST /imports/csv/preview`, `POST /imports/csv`, `GET /imports`, `GET /imports/:id`, `GET /imports/:id/errors`.
- Fila: `imports`; job: `process-csv-import`; payload armazena import ID mais conteúdo staged seguro necessário ao worker.
- Consome `LeadIngestionService`.

- [ ] Escrever testes falhando do parser para vírgula, ponto-e-vírgula, delimitador entre aspas, aspas escapadas, BOM, headers, linhas em branco e linhas malformadas.
- [ ] Executar teste do parser e confirmar falhas esperadas.
- [ ] Adicionar dependência de parser CSV mantida em vez de RFC manual; configurar limites de memória de upload.
- [ ] Implementar preview retornando headers, primeiras cinco linhas e sugestões de mapeamento determinísticas.
- [ ] Escrever testes falhando de service para isolamento de tenant, contadores, sucesso parcial, `ImportError`, duplicatas e status failed.
- [ ] Implementar registro de import, job de fila, processor e endpoints paginados.
- [ ] Validar chaves de mapeamento contra allowlist e exigir mapeamento `companyName`.
- [ ] Executar testes de import, typecheck API e build API.

### Task 5: Fluxo web de pesquisa

**Arquivos:**
- Criar: `apps/web/src/features/prospecting/api.ts`
- Criar: `apps/web/src/features/prospecting/hooks.ts`
- Criar: `apps/web/src/features/prospecting/hooks.test.tsx`
- Reescrever: `apps/web/src/pages/search-page.tsx`
- Criar: `apps/web/src/pages/search-page.test.tsx`
- Modificar: `apps/web/src/types/index.ts`

**Interfaces:**
- Consome endpoints da Task 3 e contratos paginados.
- Poll a cada 2 segundos só para `PENDING | PROCESSING`; parar em estados terminais.

- [ ] Escrever testes falhando para category/city/UF obrigatórios, filtro default sem site, submissão de search e erros de API.
- [ ] Escrever teste falhando de hook provando polling start/stop por status.
- [ ] Implementar API e hooks tipados.
- [ ] Implementar form, histórico/status, tabela de resultados, paginação, controles individual/select-all e resumo de importação.
- [ ] Desabilitar linhas já importadas e preservar seleção só na página de resultados atual.
- [ ] Adicionar labels acessíveis, comportamento de teclado e estados loading/error/empty.
- [ ] Executar testes web focados, typecheck web e build web.

### Task 6: Fluxo web CSV

**Arquivos:**
- Criar: `apps/web/src/features/imports/api.ts`
- Criar: `apps/web/src/features/imports/hooks.ts`
- Criar: `apps/web/src/pages/imports-page.tsx`
- Criar: `apps/web/src/pages/imports-page.test.tsx`
- Modificar: `apps/web/src/App.tsx`
- Modificar: `apps/web/src/components/layout/sidebar.tsx`
- Modificar: `apps/web/src/types/index.ts`

**Interfaces:**
- Consome endpoints da Task 4.
- Poll a cada 2 segundos para `PENDING | PROCESSING` e parar em status terminal.

- [ ] Escrever testes falhando de UI para seleção só CSV, preview, mapeamento company obrigatório, confirmação, progresso e erros por linha.
- [ ] Implementar APIs multipart preview/create e hooks tipados.
- [ ] Implementar upload, preview de cinco linhas, selects de mapeamento, confirmação e resumo de progresso.
- [ ] Adicionar rota imports e entrada na sidebar.
- [ ] Garantir reset do file input só após criação bem-sucedida do job.
- [ ] Executar testes web focados, typecheck web e build web.

### Task 7: Segurança cross-module e verificação de integração

**Arquivos:**
- Criar: `apps/api/src/modules/prospecting/prospecting.integration.spec.ts`
- Criar: `apps/api/src/modules/imports/imports.integration.spec.ts`
- Modificar: `README.md`
- Modificar: `docker-compose.yml` somente se configuração de worker exigir.

**Interfaces:**
- Valida Tasks 1–6 como um release.

- [ ] Escrever testes de integração com provider/filas mockados para isolamento de organização, roles proibidas, UUIDs inválidos, importações duplicadas e falhas de provider sanitizadas.
- [ ] Executar testes e confirmar que falhas expõem comportamento de integração ausente, não erros de setup de teste.
- [ ] Corrigir apenas defeitos de integração descobertos pelos testes.
- [ ] Documentar setup OpenStreetMap, requisito Redis, env vars, fluxo API, formato CSV e limitações de uso de serviços públicos.
- [ ] Executar validação e generate Prisma.
- [ ] Executar `pnpm test`, `pnpm typecheck`, `pnpm lint` e `pnpm build`; registrar totais e falhas exatos.
- [ ] Inspecionar diff/lista final de arquivos por secrets, build output gerado e mudanças não relacionadas.

## Ordem de execução

1. Task 1 estabelece schema e ingestão compartilhada.
2. Tasks 2 e trabalho de parser da 4 podem seguir em paralelo após interfaces da Task 1 estabilizarem.
3. Task 3 integra provider, fila e ingestão.
4. Task 4 completa backend CSV.
5. Tasks 5 e 6 podem seguir em paralelo após contratos de API existirem.
6. Task 7 faz verificação ampla de segurança e release.

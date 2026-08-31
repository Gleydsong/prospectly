# Plano de implementação Geo Selectors

> **Para agentes:** Implementar tarefa a tarefa. Passos usam sintaxe de checkbox para rastreamento.

**Objetivo:** Encadear selects País → Região → Cidade no SearchPage, com dados servidos pela API para todos os países de prospecting.

**Arquitetura:** Novo módulo Nest `geo` encapsula `country-state-city`. Endpoints `GET /geo/regions` e `GET /geo/cities`. Web consome via React Query e liga os selects no formulário existente.

**Stack:** NestJS, class-validator, country-state-city, Jest (API), React Hook Form + Vitest (web)

## Restrições globais

- País deve estar em `PROSPECTING_COUNTRY_CODES`
- Sem texto livre para cidade/região no formulário de search
- Manter payload de create search (`city` nome, `state` código ou nome de região conforme retorno da API — preferir `code` para região quando existir, `name` para cidade)
- Documentar progresso em `.superpowers/sdd/` a cada task
- Unit + integration/e2e obrigatórios

---

### Task 1: GeoService + testes unitários

**Arquivos:**
- Criar: `apps/api/src/modules/geo/geo.service.ts`
- Criar: `apps/api/src/modules/geo/geo.service.spec.ts`
- Criar: `apps/api/src/modules/geo/geo.module.ts`
- Modificar: `apps/api/package.json` (dependência `country-state-city`)

- [ ] Instalar `country-state-city`
- [ ] Implementar `listRegions(country)` / `listCities(country, regionCode)`
- [ ] Rejeitar países não suportados
- [ ] Testes unitários BR + PT + inválido
- [ ] Atualizar `.superpowers/sdd/progress.md`

### Task 2: GeoController + integração HTTP

**Arquivos:**
- Criar: `apps/api/src/modules/geo/geo.controller.ts`
- Criar: `apps/api/src/modules/geo/dto/query-regions.dto.ts`
- Criar: `apps/api/src/modules/geo/dto/query-cities.dto.ts`
- Criar: `apps/api/src/modules/geo/geo.integration.spec.ts`
- Modificar: `apps/api/src/app.module.ts`

- [ ] Conectar módulo
- [ ] Testes de integração 200/400
- [ ] Atualizar docs de progresso

### Task 3: Hooks web + cascata SearchPage

**Arquivos:**
- Modificar: `apps/web/src/features/prospecting/api.ts`
- Modificar: `apps/web/src/features/prospecting/hooks.ts`
- Modificar: `apps/web/src/pages/search-page.tsx`
- Modificar: `apps/web/src/pages/search-page.test.tsx`
- Criar/Modificar: testes de hooks

- [ ] Buscar regiões/cidades
- [ ] Substituir Input de cidade e Input livre de região por Selects
- [ ] Testes de cascata PT
- [ ] Atualizar docs de progresso

### Task 4: Verificação + docs finais

- [ ] Executar testes API + web para geo/search
- [ ] Escrever `.superpowers/sdd/task-geo-selectors-report.md`
- [ ] Commit se solicitado

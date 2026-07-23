# Relatório final de correções — Fase 3

Status: `DONE_WITH_CONCERNS`

## Resultado

Todos os achados `Critical`, `Important` e `Minor` das revisões finais foram
tratados, incluindo o I7 encontrado na re-revisão. O gate completo ficou verde
com 165 testes, typecheck, lint, build,
`prisma validate`, `prisma generate` e aplicação real das quatro migrations em
PostgreSQL 16 descartável.

## Correções por achado

### C1 — contrato Nominatim

- A busca usa somente `q=<cidade>, <UF>, Brasil`, `countrycodes=br` e campos de
  resposta; não combina mais consulta livre com `state` estruturado.
- O teste do provider verifica explicitamente a ausência de `city` e `state` na
  URL e preserva a validação posterior de cidade/UF.

### I1 — política e atribuição OpenStreetMap

- `RedisNominatimRateLimiter` reserva slots atomicamente com Redis `TIME`/Lua e
  impõe intervalo agregado de 1 segundo entre chamadas Nominatim, inclusive
  retries e múltiplas réplicas.
- A página de resultados mostra atribuição OpenStreetMap/ODbL com link para a
  página oficial de copyright.
- README descreve limites públicos e recomenda self-hosting/provider contratado
  para volume contínuo.

### I2 — validação CSV

- Cada candidato valida nome e limites de comprimento, e-mail, URL HTTP(S), as
  27 UFs, telefone brasileiro e CEP.
- Linhas inválidas não chegam à ingestão, geram erro parcial por linha e recebem
  somente mensagens públicas allowlisted.
- Teste misto comprova uma linha válida e cinco inválidas com contadores e erros.

### I3 — durabilidade DB para BullMQ

- `Search` persiste correlation ID e estado de dispatch.
- `Import` persiste mapping, linhas de staging, correlation ID e estado de
  dispatch; o job carrega somente ID/correlation ID e o worker busca o payload
  autoritativo no PostgreSQL.
- Jobs usam o ID do agregado como `jobId`; falha/crash de enqueue deixa o registro
  `PENDING` recuperável.
- Reconciliadores executam no bootstrap e a cada cinco segundos, republicando
  registros pendentes de forma idempotente.

### I4 — duplicado provável concorrente

- `Lead.probableDuplicateKey` persiste nome+cidade+UF normalizados e possui
  unicidade por organização.
- Ingestão e atualização calculam a chave; corrida `P2002` é reclassificada como
  `POSSIBLE_DUPLICATE` sem criação automática.
- Além do teste unitário de corrida, PostgreSQL real rejeitou uma segunda
  inserção com a mesma chave/tenant pela constraint
  `Lead_organizationId_probableDuplicateKey_key`.

### I5 — canonicalização da migration

- A migration de hardening faz preflight não destrutivo de colisões canônicas
  de domínio, e-mail, telefone e chave provável, incluindo tenant, valor e IDs no
  erro operacional.
- Somente depois do preflight canonicaliza identidades, popula a chave provável
  e cria sua constraint.
- Teste estrutural garante a ordem; `prisma migrate deploy` aplicou as quatro
  migrations sem erro em PostgreSQL 16 isolado.

### I6 — observabilidade assíncrona

- O correlation ID HTTP é persistido e propagado para o job.
- Processors carregam `organizationId` e correlation ID autoritativos do banco e
  emitem logs estruturados com `searchId`/`importId` sem secrets.
- Testes cobrem campos de contexto e redação.

### I7 — exposição e retenção do staging CSV

- Criação, histórico e detalhe usam uma projeção pública única e serialização
  allowlist. `stagedRows`, `organizationId`, `userId`, `correlationId` e
  `jobDispatchedAt` nunca entram no contrato HTTP.
- `COMPLETED` apaga `stagedRows` na mesma atualização que grava contadores e
  estado terminal; `FAILED` faz o mesmo na falha final.
- Falhas intermediárias preservam o staging para o próximo retry. Reentrega após
  estado terminal retorna idempotentemente sem tentar ler staging já apagado.
- Regressão HTTP cobre lista e detalhe com e-mail privado no staging e comprova
  que o valor e todos os campos internos não aparecem. Testes de serviço cobrem
  limpeza em sucesso/falha final e retenção durante retry.

### M1, M2 e M3

- DTO de busca faz trim, boolean estrito e rejeita categoria fora do conjunto
  fechado compartilhado antes de persistir/enfileirar.
- `@prospectly/shared-types` expõe categorias canônicas; Web usa `select` e API
  valida a mesma lista.
- UI e backend bloqueiam importação até `COMPLETED`.
- Readiness verifica PostgreSQL e Redis/BullMQ e retorna `503` com estado seguro
  quando qualquer dependência obrigatória falha.

## Evidência TDD

Os fixes comportamentais foram iniciados por testes que falharam pela razão
esperada: URL Nominatim incompatível, ausência do limiter, CSV sem validação,
dispatch irrecuperável, corrida de chave provável, migration sem preflight,
contexto de log ausente, validação permissiva, UI sem atribuição/bloqueio e
readiness sem Redis. Depois da implementação, os testes focados e amplos ficaram
verdes.

## Gate final fresco

```text
pnpm test
PASS API: 19 suítes, 135 testes
PASS Web: 9 arquivos, 30 testes
TOTAL: 28 suítes/arquivos, 165 testes, 0 falhas

pnpm typecheck
PASS: API, shared-types e Web; 0 erros

pnpm lint
PASS: API, shared-types e Web; 0 erros

pnpm build
PASS: API, shared-types e Web
Web: 2367 módulos; JS 863.00 kB (250.44 kB gzip)

prisma validate
PASS: schema.prisma válido

prisma generate
PASS: Prisma Client 6.19.3

DATABASE_URL=<banco-descartavel> prisma migrate deploy
PASS: 4/4 migrations aplicadas em PostgreSQL 16

constraint smoke
PASS: segunda chave provável do mesmo tenant rejeitada com unique violation
```

O banco descartável `prospectly_phase3_verify_20260722` foi removido após a
validação. Nenhum banco principal foi alterado.

## Arquivos centrais

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260722230000_phase_3_release_hardening/migration.sql`
- `apps/api/src/modules/prospecting/infrastructure/openstreetmap.provider.ts`
- `apps/api/src/modules/prospecting/infrastructure/nominatim-rate-limiter.ts`
- `apps/api/src/modules/prospecting/prospecting.service.ts`
- `apps/api/src/modules/imports/imports.service.ts`
- `apps/api/src/modules/leads/lead-ingestion.service.ts`
- `apps/api/src/common/health/health.controller.ts`
- `apps/web/src/pages/search-page.tsx`
- `packages/shared-types/src/index.ts`
- `README.md`
- `docs/superpowers/specs/2026-07-22-phase-3-prospecting-design.md`

## Concerns não bloqueantes

1. O smoke do provider público real não foi executado para não transformar o
   gate automatizado em dependente de internet/serviço externo. A URL e a política
   foram corrigidas contra a documentação oficial e cobertas por doubles; execute
   um smoke controlado no ambiente de release.
2. O bundle Web continua acima do aviso Vite de 500 kB: 863.00 kB minificado.
   Code splitting de rotas continua recomendado em tarefa separada.
3. `package.json#prisma` emite aviso de depreciação para Prisma 7; a versão atual
   6.19.3 valida, gera e aplica migrations normalmente.

# Task 3 — Pesquisa assíncrona e importação seletiva

## Resultado

`DONE` — backend de pesquisas OSM assíncronas, paginação multi-tenant e importação seletiva entregue. A fila usa BullMQ com Redis configurado a partir de `REDIS_URL`; os testes usam somente mocks de Prisma, fila e provider.

## TDD

### RED

1. Criado `prospecting.service.spec.ts` para criação `PENDING`, payload/jobId da fila, paginação isolada por organização, ocultação cross-tenant, transições/persistência idempotente, erro sanitizado e importação seletiva.
2. Executado:

   ```sh
   pnpm --filter @prospectly/api test -- prospecting.service.spec.ts --runInBand
   ```

   Falhou como esperado por `TS2307: Cannot find module './prospecting.service'`.
3. Criado `prospecting.processor.spec.ts` para falha sanitizada apenas na última tentativa BullMQ.
4. Executado:

   ```sh
   pnpm --filter @prospectly/api test -- prospecting.processor.spec.ts --runInBand
   ```

   Falhou como esperado: `recordFailure` não havia sido chamado.

### GREEN

Implementados DTOs, fila/processor BullMQ, serviço, controller, módulo e a configuração Redis no módulo raiz. A pesquisa persiste `PENDING`, agenda `run-search` com `jobId = search.id`, passa por `PROCESSING`, substitui resultados via upsert e conclui em `COMPLETED`. Erros do provider são propagados para retry; somente a tentativa final salva a mensagem pública sanitizada e `FAILED`.

Importação exige que todos os IDs pertençam à busca da organização atual, cria leads por `LeadIngestionService`, vincula `importedLeadId`, adiciona `sem-site`, preserva `TO_REVIEW` e retorna `imported`, `skipped`, `invalid` e `conflicts`.

## Arquivos alterados/criados

- `apps/api/package.json`
- `pnpm-lock.yaml`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/prospecting/dto/create-search.dto.ts`
- `apps/api/src/modules/prospecting/dto/query-searches.dto.ts`
- `apps/api/src/modules/prospecting/dto/import-search-results.dto.ts`
- `apps/api/src/modules/prospecting/prospecting.constants.ts`
- `apps/api/src/modules/prospecting/prospecting.service.ts`
- `apps/api/src/modules/prospecting/prospecting.service.spec.ts`
- `apps/api/src/modules/prospecting/prospecting.processor.ts`
- `apps/api/src/modules/prospecting/prospecting.processor.spec.ts`
- `apps/api/src/modules/prospecting/prospecting.controller.ts`
- `apps/api/src/modules/prospecting/prospecting.module.ts`

## Verificação

```sh
pnpm --filter @prospectly/api prisma:generate
pnpm --filter @prospectly/api lint
pnpm --filter @prospectly/api test -- --runInBand
pnpm --filter @prospectly/api typecheck
pnpm --filter @prospectly/api build
```

Resultados finais:

- Prisma client: gerado com sucesso.
- Lint: passou sem erros.
- Testes API: 7 suites, 82 testes aprovados.
- Typecheck: passou.
- Build Nest: passou.

## Auto-review

- `organizationId` vem exclusivamente do contexto de autenticação e é aplicado em histórico, detalhe, resultados e importação; recursos de outra organização retornam `404`.
- Escritas dos endpoints usam `OWNER`, `ADMIN`, `SALES` ou `MEMBER`.
- O provider e a fila são mockados em todos os testes novos; nenhum teste usa internet ou Redis.
- A mensagem persistida em falha é fixa e não expõe corpo, token ou detalhes do provider.
- Resultados são paginados e a seleção é validada integralmente antes de qualquer lead ser ingerido.
- A instalação das dependências BullMQ e geração do Prisma exigiram permissões externas somente para baixar pacotes/atualizar o cache local; nenhuma dependência externa é usada durante a suíte de testes.

## Correções após revisão

Todos os quatro apontamentos `Important` de `task-3-review.md` foram corrigidos com TDD.

### RED adicional

```sh
pnpm --filter @prospectly/api test -- redis.spec.ts prospecting.service.spec.ts prospecting.processor.spec.ts --runInBand
```

Falhou como esperado antes da implementação: o parser Redis não existia, a falha de `queue.add` retornava o erro bruto e deixava a busca pendente, o vínculo usava atualização incondicional e o processor devolvia a mensagem secreta do provider.

### GREEN adicional

- `parseRedisConnection` aceita somente `redis:` e `rediss:`, valida host/porta/database, decodifica credenciais e propaga `db` e `tls` à conexão BullMQ. `validateEnv` agora rejeita `REDIS_URL` inválida antes do bootstrap.
- Se `queue.add` falhar, a pesquisa criada é atualizada para `FAILED` com mensagem sanitizada e a API retorna `503` igualmente sanitizado; não permanece em polling `PENDING` sem job.
- O vínculo `SearchResult.importedLeadId` usa `updateMany` condicional em `importedLeadId: null`. Uma repetição após crash liga um `DUPLICATE` conhecido ao lead já criado; uma operação concorrente que perde o compare-and-set é contada como `skipped`, sem sobrescrever o vínculo vencedor.
- O worker grava o estado sanitizado somente na tentativa final e relança para BullMQ uma nova exceção fixa, sem erro, token ou corpo bruto do provider.

Verificação final após a revisão:

```sh
pnpm --filter @prospectly/api lint
pnpm --filter @prospectly/api test -- --runInBand
pnpm --filter @prospectly/api typecheck
pnpm --filter @prospectly/api build
```

- Lint: passou.
- Testes API: 8 suites, 89 testes aprovados.
- Typecheck: passou.
- Build Nest: passou.

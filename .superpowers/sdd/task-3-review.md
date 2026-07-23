# Re-revisão — Task 3: pesquisa assíncrona e importação seletiva

**Veredito: `APPROVED`**

Escopo conferido: `## Global Constraints`, `### Task 3`, relatório atualizado,
DTOs, serviço/controller/processador/módulo, configuração Redis e módulo raiz.
Esta revisão não alterou código de produção.

## Confirmação dos achados anteriores

| Achado | Estado | Evidência |
| --- | --- | --- |
| `REDIS_URL` descartava o database e não era validada | Resolvido | Parser aceita somente `redis:`/`rediss:`, valida host/porta/database e propaga `db`, credenciais e TLS (`config/redis.ts:10-45`); validação usa o parser (`config/validation.ts:20-26`) e a suíte cobre URL TLS/DB e inválidas (`config/redis.spec.ts:10-28`). |
| Falha de enqueue deixava busca `PENDING` sem job | Resolvido | Falha de `queue.add` registra `FAILED`, mensagem fixa e retorna 503 sanitizado (`prospecting.service.ts:56-71`), coberto em `prospecting.service.spec.ts:76-93`. |
| Link de resultado falhava sob crash/concorrência | Resolvido | `updateMany` faz compare-and-set em `importedLeadId: null` (`prospecting.service.ts:174-205`); DUPLICATE conhecido recupera o link e perdedor concorrente vira `skipped` (`prospecting.service.spec.ts:218-279`). |
| Erro bruto era persistido pelo BullMQ | Resolvido | Processor registra só `searchId` e relança erro público fixo (`prospecting.processor.ts:16-26`), verificado pela suíte (`prospecting.processor.spec.ts:3-30`). |

## Gate 1 — Conformidade integral com a especificação

**Aprovado.**

- Endpoints de criação, histórico, detalhe, resultados e importação seletiva estão
  presentes; escritas exigem `OWNER`, `ADMIN`, `SALES` ou `MEMBER`
  (`prospecting.controller.ts:18-57`).
- `organizationId`/ator são extraídos do contexto autenticado; leituras e
  importação verificam escopo da organização e retornam 404 para busca externa
  (`prospecting.service.ts:75-112`, `154-161`, `194-197`).
- A fila usa `prospecting`/`run-search`, `jobId = search.id`, Redis configurado por
  `REDIS_URL` e tentativas/backoff explícitos (`prospecting.constants.ts:1-13`,
  `app.module.ts:60-65`, `prospecting.service.ts:46-72`).
- Processador percorre `PENDING → PROCESSING → COMPLETED/FAILED`, persiste
  resultados por upsert e mantém a mensagem pública sanitizada
  (`prospecting.service.ts:115-146`, `208-230`; `prospecting.processor.ts:16-26`).
- Resultados e histórico são paginados; todos os IDs selecionados são validados
  antes da primeira ingestão (`prospecting.service.ts:75-112`, `154-191`).

## Gate 2 — Qualidade e correção

**Aprovado.**

- Parser Redis preserva database, autenticação e TLS, evitando conexão silenciosa
  no DB errado (`config/redis.ts:18-44`).
- Erro de scheduling não deixa polling infinito: o estado persistido e a resposta
  HTTP são coerentes e não vazam erro Redis (`prospecting.service.ts:56-71`).
- Importação é idempotente em resultado e link, incluindo recuperação pós-crash e
  concorrência; nenhum request sobrescreve o vínculo já vencido
  (`prospecting.service.ts:163-205`).
- Falhas do worker persistidas no banco e no BullMQ são sanitizadas
  (`prospecting.service.ts:137-146`; `prospecting.processor.ts:16-26`).
- Provider, fila e Prisma são mocks nas suítes; não há acesso a rede ou Redis
  durante os testes (`prospecting.service.spec.ts:13-48`,
  `prospecting.processor.spec.ts:3-30`).

## Verificação executada

```text
pnpm --filter @prospectly/api test -- redis.spec.ts prospecting.service.spec.ts prospecting.processor.spec.ts --runInBand
PASS: 3 suítes, 16 testes

pnpm --filter @prospectly/api typecheck
PASS

pnpm --filter @prospectly/api build
PASS
```

## Severidade consolidada

- Critical: nenhum.
- Important: nenhum.
- Minor: nenhum.

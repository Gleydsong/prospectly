# Re-revisão final — Fase 3 após correção de I7

**Veredito: `APPROVED`**

I7 foi corrigido sem reabrir os achados anteriores. O contrato HTTP de imports
agora usa projeção/serialização allowlist, o staging é apagado nos dois estados
terminais, permanece disponível durante tentativas intermediárias e uma
reentrega terminal retorna antes de tentar ler o payload já apagado. Não há
achados `Critical` ou `Important` remanescentes para a Fase 3.

## Resultado consolidado

| Achado | Estado | Evidência atual |
| --- | --- | --- |
| C1 — contrato Nominatim | **Resolvido** | `openstreetmap.provider.ts:249-257` usa somente `q=<cidade>, <UF>, Brasil`, sem misturar campos estruturados; validação posterior permanece em `:265-275`. |
| I1 — política/atribuição OSM | **Resolvido** | Limiter Redis global em `nominatim-rate-limiter.ts:11-52`, injetado em `prospecting.module.ts:31-43` e aplicado a cada tentativa em `openstreetmap.provider.ts:278-315`; atribuição ODbL em `search-page.tsx:337-348`. |
| I2 — validação CSV | **Resolvido** | Validação semântica e limites em `imports.service.ts:372-421`, com mensagens públicas allowlisted em `:437-459`. |
| I3 — durabilidade DB → BullMQ | **Resolvido** | Staging/estado persistidos antes do enqueue, `jobId` idempotente e reconciliadores para `PENDING` sem confirmação. |
| I4 — duplicado provável concorrente | **Resolvido** | Chave normalizada persistida e constraint `@@unique([organizationId, probableDuplicateKey])`, com reclassificação de `P2002`. |
| I5 — canonicalização legada | **Resolvido** | Migration realiza preflight canônico antes das alterações e da constraint; 4/4 migrations já foram aplicadas em PostgreSQL 16 descartável na re-revisão anterior. |
| I6 — observabilidade assíncrona | **Resolvido** | Processors registram agregado, tenant autoritativo e correlation ID. |
| I7 — exposição/retenção do staging | **Resolvido** | Confirmado em detalhe abaixo. |
| M1 — DTO permissivo | **Resolvido** | Trim, categoria/UF fechadas e boolean estrito. |
| M2 — categorias/bloqueio de importação | **Resolvido** | Contrato compartilhado e importação restrita a `COMPLETED` na API e Web. |
| M3 — readiness Redis | **Resolvido** | Readiness verifica PostgreSQL e Redis e retorna `503` seguro. |

## Confirmação de I7

### 1. Não exposição no contrato HTTP

- `IMPORT_PUBLIC_SELECT` define uma allowlist única em
  `apps/api/src/modules/imports/imports.service.ts:26-37`.
- `serializePublicImport` reconstrói a resposta somente com essas chaves em
  `imports.service.ts:39-50`, protegendo também contra records/doubles que tragam
  propriedades extras.
- Criação usa a projeção e o serializer em `imports.service.ts:95-115`.
- Histórico usa `select` e serializa cada item em `imports.service.ts:140-155`.
- Detalhe usa a mesma projeção em `imports.service.ts:158-160,263-269`.
- Assim, `stagedRows`, `organizationId`, `userId`, `correlationId` e
  `jobDispatchedAt` não fazem parte de criação, lista ou detalhe. A regressão HTTP
  ainda usa um e-mail privado dentro do staging e comprova que ele não aparece no
  JSON (`imports.integration.spec.ts:187-223`).

### 2. Limpeza nos estados terminais

- A mesma atualização que marca `COMPLETED` grava os contadores e define
  `stagedRows: Prisma.DbNull` em `imports.service.ts:243-253`.
- A falha final marca `FAILED` e limpa staging em
  `imports.service.ts:256-260`.
- Testes de serviço verificam limpeza em conclusão normal, validação parcial e
  falha final (`imports.service.spec.ts:251-359,406-415`).

### 3. Preservação durante retry

- Uma exceção transitória interrompe `process` antes da atualização terminal;
  não existe limpeza no caminho intermediário (`imports.service.ts:188-253`).
- O processor chama `recordFailure` somente quando
  `attemptsMade + 1 >= attempts`; tentativas anteriores apenas relançam para o
  BullMQ (`imports.processor.ts:16-32`, com 3 tentativas em
  `imports.constants.ts:6-11`).
- A regressão provoca falha após uma linha, confirma que staging não foi limpo e
  reprocessa as mesmas linhas com sucesso (`imports.service.spec.ts:361-404`).

### 4. Idempotência após retry e estado terminal

- Cada linha continua usando identidade determinística
  `csv-import:{importId}:{row}`; no retry, linhas já ingeridas são reconhecidas e
  os contadores são recalculados sem duplicar leads.
- `process` retorna imediatamente para `COMPLETED` ou `FAILED`, antes de ler
  mapping/staging (`imports.service.ts:188-197`). Portanto, uma reentrega após a
  limpeza é um no-op e não falha por ausência de staging.
- A integração processa o mesmo job duas vezes e confirma uma única ingestão,
  contadores estáveis e staging limpo
  (`imports.integration.spec.ts:225-267`).

## Verificação fresca desta re-revisão

```text
pnpm --filter @prospectly/api test -- --runInBand
  imports.service.spec.ts + imports.processor.spec.ts
PASS: 2 suítes, 13 testes, 0 falhas

pnpm --filter @prospectly/api test -- --runInBand
  imports.integration.spec.ts
PASS: 1 suíte, 5 testes, 0 falhas

pnpm --filter @prospectly/api typecheck
PASS: 0 erros

pnpm --filter @prospectly/api lint
PASS: 0 erros
```

A suíte HTTP foi executada fora do sandbox porque o Supertest precisa abrir um
listener local. O relatório de fixes também registra o gate amplo fresco com 165
testes, builds, Prisma validate/generate e as quatro migrations aprovados. Nesta
re-revisão não houve nova alteração de schema/migration, então a prova PostgreSQL
anterior permanece aplicável.

## Riscos não bloqueantes

- O smoke controlado do provider público OSM continua sendo uma etapa manual de
  release para evitar teste automatizado dependente de internet.
- O bundle Web mantém o aviso de tamanho do Vite; code splitting pode ser tratado
  separadamente.
- A configuração Prisma em `package.json` tem aviso de depreciação para Prisma 7,
  sem afetar a versão 6.19.3 atual.

## Conclusão

A correção atende integralmente o gate de I7 e preserva a durabilidade e a
idempotência que resolveram I3. A Fase 3 está aprovada no estado revisado.

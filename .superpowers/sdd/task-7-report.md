# Task 7 — Segurança cross-module e verificação de integração

Status: `DONE_WITH_CONCERNS`

## Resultado

A Fase 3 foi integrada e verificada com a aplicação HTTP NestJS real para as
fronteiras de controller, versionamento, pipes, decorators e RBAC. Prisma,
provider OpenStreetMap, BullMQ e ingestão foram substituídos por doubles
determinísticos; nenhum teste acessou internet, Redis ou PostgreSQL.

Foram adicionadas duas suítes de integração, com sete cenários:

- escrita bloqueada para `VIEWER` antes de persistência ou enqueue;
- UUID inválido rejeitado pelo `ParseUUIDPipe` antes do serviço;
- recurso de outra organização ocultado com `404`;
- importação seletiva HTTP idempotente;
- falha final do provider sanitizada no processor e na persistência;
- upload multipart CSV atravessando interceptor, transformação e validação;
- retry do mesmo job CSV com contadores estáveis e identidade autoritativa do
  registro persistido.

## Defeitos encontrados e corrigidos por TDD

### 1. Mapping multipart válido era rejeitado

**RED:** `POST /api/v1/imports/csv` com `mapping` JSON
`{"companyName":"Empresa"}` retornou `400` com
`each value in mapping must be a string`.

**Causa:** `@IsString({ each: true })` não percorre valores de objetos simples do
JavaScript; validava o objeto transformado como se ele próprio devesse ser string.

**GREEN:** removido somente o decorator incompatível. `@IsObject()` permanece na
fronteira e `ImportsService.validateMapping` continua validando `companyName`,
allowlist, tipo string e conteúdo de cada valor antes de persistir ou enfileirar.

### 2. Worker CSV confiava na identidade do payload BullMQ

**RED:** um job adulterado com `organizationId=org-attacker` e
`userId=user-attacker` fazia a ingestão no tenant/ator do payload, apesar de o
registro `Import` pertencer a `org-1/user-1`.

**Causa:** `ImportsService.process` carregava o registro persistido, mas usava
`job.organizationId/job.userId` na ingestão e na recuperação idempotente.

**GREEN:** ingestão e lookup de duplicidade agora usam exclusivamente
`importRecord.organizationId/importRecord.userId`, originalmente persistidos a
partir do JWT. O mesmo job processado duas vezes terminou com
`importedCount=1`, `skippedCount=0` e `invalidCount=0`.

### Compatibilidade dos testes existentes

Dois testes unitários antigos representavam o `Import` persistido apenas como
`{ id }`. As fixtures foram alinhadas ao modelo real com `organizationId` e
`userId`; nenhuma expectativa funcional foi relaxada.

## Documentação e operação

O `README.md` agora documenta:

- dependência de Redis/BullMQ e por que não há worker Docker separado nesta fase;
- todas as variáveis OSM e CSV;
- fluxos HTTP de pesquisa, polling, importação seletiva, preview e importação CSV;
- formato CSV, delimitadores, BOM, mappings, erros parciais e texto/fórmulas;
- semântica conservadora de `NO_WEBSITE_REPORTED`;
- limites dos serviços públicos Nominatim/Overpass e indicação de self-hosting
  ou capacidade contratada para volume contínuo;
- Fase 3 marcada como concluída.

`docker-compose.yml` não precisou ser alterado: Redis já usa AOF, a API depende
dos healthchecks de PostgreSQL/Redis e os processors rodam no processo NestJS.

## Arquivos da Task 7

- `apps/api/src/modules/prospecting/prospecting.integration.spec.ts` (novo)
- `apps/api/src/modules/imports/imports.integration.spec.ts` (novo)
- `apps/api/src/modules/imports/dto/create-csv-import.dto.ts`
- `apps/api/src/modules/imports/imports.service.ts`
- `apps/api/src/modules/imports/imports.service.spec.ts`
- `README.md`
- `.superpowers/sdd/task-7-report.md` (novo)
- `.superpowers/sdd/progress.md`

## Evidência de verificação

### RED e GREEN focados

```text
RED 1: imports.integration.spec.ts
FAIL: esperado 202, recebido 400
mensagem: each value in mapping must be a string

RED 2: imports.integration.spec.ts
FAIL: ingest recebeu org-attacker/user-attacker em vez de org-1/user-1

GREEN final focado:
pnpm --filter @prospectly/api test -- imports.integration.spec.ts prospecting.integration.spec.ts imports.service.spec.ts imports.controller.spec.ts --runInBand
PASS: 4 suítes, 19 testes, 0 falhas
```

### Prisma

```text
pnpm --filter @prospectly/api exec prisma validate
PASS: schema.prisma válido

pnpm --filter @prospectly/api exec prisma generate
PASS: Prisma Client 6.19.3 gerado em 90 ms
```

Ambos emitiram o aviso não bloqueante já conhecido: `package.json#prisma` será
removido no Prisma 7 e deverá migrar futuramente para `prisma.config.ts`.

### Gate completo do workspace

```text
pnpm test
PASS API: 14 suítes, 118 testes
PASS Web: 9 arquivos, 29 testes
TOTAL: 23 suítes/arquivos, 147 testes, 0 falhas

pnpm typecheck
PASS: API, shared-types e Web; 0 erros

pnpm lint
PASS: API, shared-types e Web; 0 erros

pnpm build
PASS: API, shared-types e Web
Web: 2367 módulos transformados; JS 861.62 kB (249.97 kB gzip)
```

## Auditoria final sem Git

A instrução desta task proibiu Git. A inspeção foi feita pela lista de arquivos
modificados durante a janela da Task 7 e por scans do filesystem:

- os únicos fontes/documentos tocados são os arquivos listados acima;
- nenhum arquivo de domínio fora da Fase 3 foi alterado;
- nenhum padrão de private key, AWS key, token OpenAI/GitHub/Slack foi encontrado
  em fonte, configuração versionável ou documentação;
- `super-secret` e `secret-token` aparecem somente como strings deliberadamente
  falsas em testes que comprovam sanitização;
- `dist/` e `*.tsbuildinfo` foram regenerados por `pnpm build`, já existiam no
  checkout e estão ignorados por `.gitignore`; não são entrega fonte;
- o cache Vitest sob `apps/web/node_modules/.vite/` também é local e ignorado.

## Concerns não bloqueantes

1. O bundle inicial web permanece em 861.62 kB, acima do aviso Vite de 500 kB.
   Code splitting de rotas é recomendável em uma task própria; não foi alterado
   aqui para respeitar a proibição de refactor fora da Fase 3.
2. A configuração Prisma em `package.json#prisma` está deprecada para o futuro
   Prisma 7, mas validate/generate passam na versão atual 6.19.3.
3. Conforme a constraint da spec, as integrações automatizadas não acessam
   PostgreSQL, Redis nem OSM reais. Validação de rollout da migration e smoke test
   com infraestrutura real continuam sendo etapas operacionais de deploy.

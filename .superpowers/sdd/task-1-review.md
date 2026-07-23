# Revisão final — Task 1: persistência e ingestão compartilhada de leads

**Veredito: `APPROVED`**

Escopo revisado: `## Global Constraints`, `### Task 1`, relatório atualizado,
schema, migration, serviço de ingestão, serviço manual, DTO/módulo e testes. Esta
revisão não alterou código de produção.

## Confirmação dos achados de revisão

| Achado | Estado | Evidência |
| --- | --- | --- |
| Default de `SearchResult.websitePresence` divergente | Resolvido | Defaults temporários são removidos na migration (`migration.sql:18-20`), como no schema (`schema.prisma:534-548`). |
| Corrida para domínio/telefone/e-mail | Resolvido | Constraints por organização e recuperação de `P2002` fora da transação (`schema.prisma:268-271`; `lead-ingestion.service.ts:111-180`). |
| Cobertura multi-tenant na ingestão | Resolvido | Teste de mesma identidade em organizações distintas (`lead-ingestion.service.spec.ts:61-91`). |
| Soft delete contraditório | Resolvido | A política explícita não recria leads removidos e é aplicada no serviço e update (`lead-ingestion.service.ts:199-255`; `leads.service.ts:242-275`). |
| Migration insegura diante de duplicatas legadas | Resolvido | Detecção não destrutiva e determinística ocorre antes dos índices únicos (`migration.sql:22-106`). |
| `P2002` sem tratamento no update | Resolvido | Update converte erro único em `ConflictException` (`leads.service.ts:134-151`) e há teste específico (`leads.service.spec.ts:115-126`). |
| Índices redundantes | Resolvido | Schema mantém somente chaves únicas e migration remove os índices anteriores (`schema.prisma:268-277`; `migration.sql:96-118`). |
| Formatos equivalentes de telefone no update | Resolvido | Update normaliza e persiste E.164 com a mesma função da ingestão (`leads.service.ts:125-142`; `lead-ingestion.service.ts:55-64`); teste valida a colisão `'(11) 99876-5432'` versus `'+5511998765432'` (`leads.service.spec.ts:128-153`). |

## Gate 1 — Conformidade integral com a especificação

**Aprovado.**

- Enum, estados, campos e constraints da Task 1 estão presentes e a migration
  reproduz o estado final do schema (`schema.prisma:90-101`, `237-277`, `534-548`;
  `migration.sql:1-121`).
- O serviço compartilhado expõe o contrato `ingest(organizationId, actorId,
  candidate)` e retorna `IMPORTED`, `DUPLICATE` ou `POSSIBLE_DUPLICATE`
  (`lead-ingestion.service.ts:51-53`, `104-180`).
- A criação manual continua delegando para a ingestão com `status: NEW`, usando
  contexto autenticado e mantendo conflito controlado (`leads.controller.ts:46-54`;
  `leads.service.ts:101-119`).
- O preflight de migration preserva os dados e bloqueia explicitamente duplicatas
  legadas antes de impor as chaves únicas (`migration.sql:22-94`).

## Gate 2 — Qualidade e correção

**Aprovado.**

- A deduplicação é tenant-scoped, tem proteção no banco contra corrida e retorna
  o vencedor após `P2002` (`lead-ingestion.service.ts:111-180`, `199-255`).
- Criação e update usam a mesma representação E.164 para telefones brasileiros;
  a pré-checagem, a constraint e a persistência operam sobre o mesmo valor
  canônico (`lead-ingestion.service.ts:55-64`; `leads.service.ts:125-142`,
  `242-275`).
- A política de soft delete está alinhada entre checagem, constraints e resposta
  pública, e conflitos de update não viram HTTP 500 (`leads.service.ts:137-151`,
  `261-275`).
- Testes cobrem normalização, identidades externas, domínio/e-mail, concorrência
  simulada, provável duplicidade, tags/defaults, isolamento entre organizações,
  delegação manual e conflitos de update (`lead-ingestion.service.spec.ts`;
  `leads.service.spec.ts`).

## Verificação executada

```text
pnpm --filter @prospectly/api test -- lead-ingestion.service.spec.ts leads.service.spec.ts --runInBand
PASS: 2 suites, 18 testes

pnpm --filter @prospectly/api typecheck
PASS

pnpm --filter @prospectly/api exec prisma validate
PASS (com aviso pré-existente de depreciação package.json#prisma)
```

## Severidade consolidada

- Critical: nenhum.
- Important: nenhum.
- Minor: nenhum.

**Observação operacional:** a migration não foi aplicada contra um dump real nesta
revisão. O preflight SQL impede alteração de índices quando existirem duplicatas
legadas exatas; validar o rollout com backup/dump permanece uma etapa prudente de
deploy, mas não bloqueia a conformidade da Task 1.

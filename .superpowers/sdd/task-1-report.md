# Task 1 — Persistência e ingestão compartilhada de leads

## Escopo entregue

- Adicionado o enum `WebsitePresence`, `SearchStatus.PROCESSING`, campos de presença de website em `Lead`, dados normalizados em `SearchResult` e as restrições únicas exigidas.
- Criada a migration `20260722200000_phase_3_prospecting`, compatível com o schema. Para tabelas já preenchidas, `normalizedData` recebe temporariamente `{}` durante o `ALTER TABLE` e o default é removido em seguida, mantendo o schema final sem default.
- Criado `LeadIngestionService.ingest(organizationId, actorId, candidate)` com normalização determinística e deduplicação na ordem: identidade externa, domínio, telefone, e-mail e nome+cidade+UF.
- A criação manual delega para a camada de ingestão, preservando `status: NEW` e o formato serializado de resposta; conflitos continuam a retornar `ConflictException`.
- `LeadsModule` exporta `LeadIngestionService` para o consumo das tasks seguintes.

## Arquivos modificados/criados

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260722200000_phase_3_prospecting/migration.sql`
- `apps/api/src/modules/leads/lead-ingestion.service.ts`
- `apps/api/src/modules/leads/lead-ingestion.service.spec.ts`
- `apps/api/src/modules/leads/leads.module.ts`
- `apps/api/src/modules/leads/leads.service.ts`
- `apps/api/src/modules/leads/leads.service.spec.ts`
- `apps/api/src/modules/leads/dto/create-lead.dto.ts`

## TDD: RED → GREEN

### RED 1 — serviço de ingestão

1. Escrevi `lead-ingestion.service.spec.ts` antes da implementação, cobrindo normalização de telefone brasileiro, duplicidade por identidade externa, domínio/e-mail, provável duplicidade nome+cidade+UF, tags e defaults `TO_REVIEW`.
2. Executei:

   ```bash
   pnpm --filter @prospectly/api test -- lead-ingestion.service.spec.ts --runInBand
   ```

3. Resultado esperado: falha `TS2307: Cannot find module './lead-ingestion.service'`; 1 suíte falhou, 0 testes executados. A falha comprovou a ausência da implementação, não um erro de asserção.

### GREEN 1 — implementação mínima

1. Adicionei schema, migration e a implementação transacional do serviço.
2. A primeira execução revelou um único desvio de contrato: o resultado de provável duplicidade expunha `city` e `state` além de `id` e `companyName`.
3. Corrigi somente esse retorno e executei novamente:

   ```bash
   pnpm --filter @prospectly/api test -- lead-ingestion.service.spec.ts --runInBand
   ```

4. Resultado: 1 suíte aprovada, 6 testes aprovados.

### RED 2 — delegação da criação manual

1. Antes de mudar `LeadsService`, atualizei os testes de leads para exigir a nova dependência e verificar a delegação à ingestão compartilhada.
2. Executei:

   ```bash
   pnpm --filter @prospectly/api test -- leads.service.spec.ts --runInBand
   ```

3. Resultado esperado: `TS2554: Expected 1 arguments, but got 2`, pois `LeadsService` ainda não recebia o serviço de ingestão.

### GREEN 2 — integração manual

1. Injetei `LeadIngestionService`, encaminhei o DTO para `ingest` com `status: NEW` para criação manual e preservei a resposta/erro público.
2. Executei:

   ```bash
   pnpm --filter @prospectly/api test -- leads.service.spec.ts lead-ingestion.service.spec.ts --runInBand
   ```

3. Resultado: 2 suítes aprovadas, 11 testes aprovados.

## Verificações finais

```bash
pnpm --filter @prospectly/api test -- leads.service.spec.ts lead-ingestion.service.spec.ts --runInBand
# PASS: 2 suítes, 11 testes

pnpm --filter @prospectly/api prisma:generate
# PASS: Prisma Client v6.19.3 gerado

pnpm --filter @prospectly/api typecheck
# PASS

pnpm --filter @prospectly/api exec prisma validate
# PASS: schema válido

pnpm exec prettier --check apps/api/src/modules/leads/lead-ingestion.service.ts apps/api/src/modules/leads/lead-ingestion.service.spec.ts apps/api/src/modules/leads/leads.service.ts apps/api/src/modules/leads/leads.service.spec.ts apps/api/src/modules/leads/leads.module.ts apps/api/src/modules/leads/dto/create-lead.dto.ts
# PASS
```

`prisma generate`, `prisma validate` e o primeiro `prettier --check` emitiram apenas o aviso pré-existente de depreciação de `package.json#prisma`; isso não bloqueia a Task 1. O primeiro `prettier --check` também não consegue inferir parser para `.prisma` e `migration.sql`, por isso o schema foi formatado com `prisma format` e os arquivos TypeScript com Prettier.

## Auto-revisão

- A deduplicação forte não filtra `deletedAt`; assim, um lead soft-deleted não é recriado silenciosamente.
- A criação usa transação e a restrição Prisma/SQL; um `P2002` concorrente volta como `DUPLICATE`.
- `externalId` é protegido pela unicidade `(organizationId, source, externalId)` e `SearchResult` pela unicidade `(searchId, externalId)`.
- Telefone é armazenado em E.164 brasileiro quando tem 10/11 dígitos nacionais ou já vem com `55`; e-mail/domínio são lowercase.
- A comparação provável remove acentos e pontuação de nome/cidade, preservando os valores de apresentação gravados no lead.
- Não foram feitas mudanças em módulos de prospecting/imports, web ou nas tasks 2–7.

## Concerns

- A migration foi validada sintaticamente pelo Prisma, mas não foi aplicada a um banco local nesta task para não depender de infraestrutura de banco nem alterar dados de desenvolvimento.

## Fixes da revisão Task 1

### Migration e schema alinhados

- A migration agora remove o default temporário de `SearchResult.websitePresence` após preencher registros preexistentes, tal como já fazia para `normalizedData`. O banco final e `schema.prisma` exigem ambos os campos sem default.
- Foram declaradas e migradas as chaves únicas por organização para `domain`, `phone` e `email`, além da identidade externa já existente. Em PostgreSQL, uma chave única composta com uma coluna nullable permite múltiplos valores `NULL`; portanto leads sem cada identificador continuam permitidos.

### Deduplicação concorrente e soft-delete

- A decisão de unicidade é atômica no banco: as leituras antecipadas mantêm a resposta rápida, e os índices únicos são o árbitro final entre jobs concorrentes.
- Em caso de `P2002`, a transação que tentou criar é encerrada e a identidade vencedora é relida fora dela. Isso evita consultar uma transação PostgreSQL abortada e devolve `DUPLICATE` com o lead existente para domínio, telefone, e-mail ou identidade externa.
- Política explícita de soft-delete: não há recriação silenciosa. As buscas fortes e prováveis incluem registros soft-deleted, e as chaves únicas também os incluem. O fluxo retorna conflito com o lead existente, que deve ser restaurado explicitamente quando apropriado.

### TDD da correção

1. Antes de alterar o serviço, ampliei `lead-ingestion.service.spec.ts` com: isolamento multi-tenant para identidade externa e três casos de corrida que simulam `P2002` para domínio, telefone e e-mail, exigindo que o lead vencedor seja retornado.
2. RED executado:

   ```bash
   pnpm --filter @prospectly/api test -- lead-ingestion.service.spec.ts --runInBand
   ```

   Resultado: 1 suíte falhou; 8 de 10 testes falharam. As falhas esperadas provaram que a consulta excluía `deletedAt` e que `P2002` devolvia `lead: null`.
3. GREEN após adicionar índices únicos, remover o filtro de soft-delete das consultas de deduplicação e reler o vencedor fora da transação:

   ```bash
   pnpm --filter @prospectly/api test -- lead-ingestion.service.spec.ts leads.service.spec.ts --runInBand
   # PASS: 2 suítes, 15 testes

   pnpm --filter @prospectly/api prisma:generate
   # PASS

   pnpm --filter @prospectly/api exec prisma validate
   # PASS

   pnpm --filter @prospectly/api typecheck
   # PASS
   ```

O aviso de depreciação de `package.json#prisma` permaneceu o único aviso emitido por comandos Prisma e não bloqueia a entrega.

## Fixes da re-revisão Task 1

### Dados legados antes das constraints

- Antes de remover índices antigos ou criar qualquer chave única, a migration executa uma detecção **não destrutiva** de duplicatas legadas de domínio, e-mail, telefone e identidade externa.
- A escolha do conflito reportado é determinística: ordena por tipo, organização e valor; os IDs são ordenados por `createdAt` e `id`. Ao encontrar um caso, lança `23505` com tipo, `organizationId`, valor e todos os `leadIds`, e o deploy é interrompido sem alterar leads.
- A política é deliberadamente operacional, não uma deduplicação automática: dados legados não são mesclados, apagados nem têm identificadores anulados. O operador resolve/restaura os leads listados e executa a migration novamente; só então as constraints entram em vigor.
- Removi os três `@@index` não únicos redundantes de `email`, `domain` e `phone`, bem como os índices SQL correspondentes, pois as três chaves únicas por organização fornecem o mesmo prefixo B-tree.

### Update e novos conflitos únicos

- `LeadsService.assertNotDuplicate` agora inclui soft-deleted, igual à política de ingestão e às constraints.
- `LeadsService.update` converte um `P2002` de corrida em `ConflictException`, evitando que o endpoint exponha erro 500 para um conflito de unicidade concorrente.

### TDD da re-revisão

1. Acrescentei antes da mudança dois testes em `leads.service.spec.ts`: valor de e-mail pertencente a lead soft-deleted não pode ser gravado; e um `P2002` concorrente no `update` deve devolver `ConflictException`.
2. RED executado:

   ```bash
   pnpm --filter @prospectly/api test -- leads.service.spec.ts --runInBand
   ```

   Resultado: 1 suíte falhou; 2 de 7 testes falharam. O primeiro terminou em `TypeError` após a pré-checagem ignorar o soft-deleted; o segundo propagou o objeto `{ code: 'P2002' }` em vez de um `ConflictException`.
3. GREEN e validação final:

   ```bash
   pnpm --filter @prospectly/api test -- leads.service.spec.ts lead-ingestion.service.spec.ts --runInBand
   # PASS: 2 suítes, 17 testes

   pnpm --filter @prospectly/api prisma:generate
   # PASS

   pnpm --filter @prospectly/api exec prisma validate
   # PASS

   pnpm --filter @prospectly/api typecheck
   # PASS
   ```

O SQL de detecção foi revisado estruturalmente, mas a migration continua não aplicada a um banco local: isso evita modificar dados de desenvolvimento e deixa a validação de rollout com um dump/backup real como etapa operacional obrigatória.

## Fix final da revisão Task 1

### Telefone no update

- `LeadsService.update` agora reutiliza `normalizeBrazilianPhone` da ingestão antes da pré-checagem e ao montar o `data` persistido. Assim, `(11) 99876-5432` e `+55 (11) 99876-5432` são tratados como `+5511998765432` em todos os write paths da Task 1.
- `assertNotDuplicate` recebe somente o valor já canônico; a consulta e a chave única passam a operar sobre a mesma representação textual.

### TDD

1. Adicionei o teste que tenta atualizar um lead com `(11) 99876-5432` quando outro lead do mesmo tenant já possui `+5511998765432`; ele exige `ConflictException`, nenhuma escrita e consulta pelo E.164.
2. RED executado após corrigir a tipagem do mock de teste:

   ```bash
   pnpm --filter @prospectly/api test -- leads.service.spec.ts --runInBand
   ```

   Resultado: 1 suíte falhou; 1 de 8 testes falhou com `TypeError`, porque a implementação antiga não localizava o número E.164 e seguia para o update.
3. GREEN:

   ```bash
   pnpm --filter @prospectly/api test -- leads.service.spec.ts lead-ingestion.service.spec.ts --runInBand
   # PASS: 2 suítes, 18 testes

   pnpm --filter @prospectly/api typecheck
   # PASS
   ```

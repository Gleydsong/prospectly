# Task 4 — Prévia CSV e importação assíncrona

## Resultado

DONE — backend completo de prévia e importação CSV assíncrona entregue. A fila
usa a configuração BullMQ/Redis existente na raiz, enquanto todos os testes
usam mocks de fila, Prisma, parser e ingestão; não foi necessário iniciar Redis.

## TDD

### RED

1. csv-parser.service.spec.ts foi criado para vírgula, ponto e vírgula,
   campos delimitados por aspas, aspas escapadas, BOM UTF-8, linhas vazias,
   cabeçalho e linhas malformadas.

       pnpm --filter @prospectly/api test -- csv-parser.service.spec.ts --runInBand

   Falhou como esperado por TS2307: Cannot find module './csv-parser.service'.

2. imports.service.spec.ts foi criado para prévia CSV, criação PENDING,
   payload/jobId, mapeamento obrigatório/allowlist, falha de enqueue
   sanitizada, isolamento por organização, sucesso parcial, ImportError,
   duplicatas, status final e paginação de erros.

       pnpm --filter @prospectly/api test -- imports.service.spec.ts --runInBand

   Falhou como esperado por TS2307: Cannot find module './imports.service'.

3. imports.processor.spec.ts e imports.controller.spec.ts foram criados antes
   das respectivas implementações. Ambos falharam inicialmente por módulo
   inexistente e ficaram verdes após a implementação mínima.

### GREEN

- Adicionada a dependência mínima mantida csv-parse@^5.6.0; o parsing RFC não
  foi implementado manualmente.
- O parser detecta vírgula/ponto e vírgula, remove BOM, preserva conteúdo entre
  aspas, limita prévia a cinco linhas e produz sugestões determinísticas.
- Upload aceita exclusivamente .csv, usa memória via Multer e aplica limites
  configuráveis por CSV_MAX_FILE_SIZE_BYTES e CSV_MAX_ROWS.
- POST /imports/csv cria Import(PENDING), persiste mapeamento/contagem,
  enfileira imports/process-csv-import com jobId igual ao import.id e dados
  necessários ao worker.
- O worker processa cada linha por LeadIngestionService, permite sucesso
  parcial, persiste ImportError, conta importados/ignorados/inválidos e só
  registra FAILED na tentativa final com mensagem de worker sanitizada.
- Histórico, detalhe e erros são paginados e isolados por organizationId;
  recursos externos retornam 404. Escritas preservam os papéis existentes.

## Arquivos alterados/criados

- apps/api/package.json
- pnpm-lock.yaml
- apps/api/.env.example
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260722213000_import_row_idempotency/migration.sql
- apps/api/src/app.module.ts
- apps/api/src/config/configuration.ts
- apps/api/src/config/validation.ts
- apps/api/src/modules/imports/csv-parser.service.ts
- apps/api/src/modules/imports/csv-parser.service.spec.ts
- apps/api/src/modules/imports/dto/create-csv-import.dto.ts
- apps/api/src/modules/imports/dto/query-imports.dto.ts
- apps/api/src/modules/imports/imports.constants.ts
- apps/api/src/modules/imports/imports.service.ts
- apps/api/src/modules/imports/imports.service.spec.ts
- apps/api/src/modules/imports/imports.processor.ts
- apps/api/src/modules/imports/imports.processor.spec.ts
- apps/api/src/modules/imports/imports.controller.ts
- apps/api/src/modules/imports/imports.controller.spec.ts
- apps/api/src/modules/imports/imports.module.ts

## Verificação

    pnpm --filter @prospectly/api test -- csv-parser.service.spec.ts imports.service.spec.ts imports.processor.spec.ts imports.controller.spec.ts --runInBand
    pnpm --filter @prospectly/api test -- --runInBand
    pnpm --filter @prospectly/api lint
    pnpm --filter @prospectly/api typecheck
    pnpm --filter @prospectly/api build

Resultados finais:

- Testes focados: 4 suítes, 20 testes aprovados.
- Testes API completos: 12 suítes, 109 testes aprovados.
- Lint, typecheck e build Nest: aprovados.

## Auto-review

- Nenhum teste novo usa rede ou Redis real.
- organizationId e ator são exclusivamente derivados do JWT; detalhe/erros
  aplicam filtro de organização antes da consulta.
- Arquivos não CSV, cabeçalho ausente, CSV malformado, mapeamento sem
  companyName, chaves fora da allowlist e cabeçalhos inexistentes são
  rejeitados explicitamente.
- Falhas de enqueue retornam 503 sem detalhes Redis; falhas finais do worker
  expõem apenas mensagem fixa. Logs do worker incluem importId e organizationId.
- Conteúdo CSV é tratado apenas como texto e não há execução de fórmulas.
- A única alteração de schema é a constraint ImportError(importId, row),
  necessária para idempotência da própria Task 4; nenhum módulo alheio mudou.

## Correções após revisão

Todos os quatro apontamentos Important de task-4-review.md foram corrigidos
com RED/GREEN adicional.

### RED adicional

1. O parser recebeu testes que excedem o limite de linhas tanto em parse quanto
   em preview. Antes da correção, a assinatura não aceitava limite e a prévia
   materializava o arquivo inteiro.
2. A suíte do serviço passou a enviar mapping.companyName como número, objeto e
   array. Antes da correção, o serviço falhava com TypeError, não com 400.
3. A suíte simulou banco transitório após uma primeira linha importada e uma
   reexecução do mesmo job. Antes da correção, a exceção virava invalidCount e
   a primeira linha era recontada como duplicate.
4. A asserção do candidato de ingestão passou a exigir source CSV_IMPORT e um
   externalId determinístico por importação/linha.

### GREEN adicional

- CsvParserService recebe maxRows, usa o limite no próprio csv-parse e aborta
  após a primeira linha excedente; preview encaminha o mesmo limite configurado.
- Mapping é validado antes de trim: cada valor deve ser string não vazia,
  inclusive quando o serviço é chamado fora do ValidationPipe. O DTO também
  declara IsString para cada valor.
- Falhas parciais são apenas BadRequestException de linha. Falhas transitórias
  são relançadas ao processor para retry BullMQ.
- Cada candidato recebe source CSV_IMPORT e externalId
  csv-import:{importId}:{row}. Em retry, a presença desta identidade durável
  torna uma repetição de ingestão novamente imported para fins de contador.
- ImportError usa upsert por importId/row; a constraint única e a migration
  20260722213000_import_row_idempotency impedem duplicação de erros em retry.

Verificação após as correções:

    pnpm --filter @prospectly/api prisma:generate
    pnpm --filter @prospectly/api test -- csv-parser.service.spec.ts imports.service.spec.ts imports.processor.spec.ts imports.controller.spec.ts --runInBand
    pnpm --filter @prospectly/api test -- --runInBand
    pnpm --filter @prospectly/api lint
    pnpm --filter @prospectly/api typecheck
    pnpm --filter @prospectly/api build

- Prisma generate: aprovado.
- Testes focados: 4 suítes, 22 testes aprovados.
- Testes API completos: 12 suítes, 111 testes aprovados.
- Lint, typecheck e build Nest: aprovados.

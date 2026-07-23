# Revisão — Task 4: prévia CSV e importação assíncrona

**Veredito: `APPROVED`**

Escopo conferido: `## Global Constraints`, `### Task 4`, relatório da task,
parser, DTO, serviço, worker, controller, módulo, schema/migration e suítes.
Esta revisão não alterou código de produção.

## Gate 1 — Conformidade integral com a especificação

**Aprovado.** O fluxo aceita apenas CSV multipart, faz prévia limitada a cinco
linhas, mantém parser suportado, aceita vírgula/ponto e vírgula/BOM e mantém o
conteúdo como texto, sem avaliar fórmulas. O limite configurado agora é passado
tanto à prévia quanto à criação e o parser interrompe a leitura após `maxRows + 1`
registros, recusando o arquivo antes de materializar todas as suas linhas.

O DTO exige que cada valor de `mapping` seja string e o serviço também faz type
guard antes de usar `trim`; `companyName`, allowlist e cabeçalhos seguem validados
antes de criar o job. Histórico, detalhe e erros continuam isolados por
organização.

## Gate 2 — Qualidade, retry e idempotência

**Aprovado.** Somente `BadRequestException` prevista para a linha é persistida
como erro parcial. Falhas transitórias são relançadas ao BullMQ e o worker marca
`FAILED` apenas ao esgotar as tentativas.

Cada linha recebe identidade determinística
`csv-import:{importId}:{row}` e `source: CSV_IMPORT`. Em reexecuções, uma resposta
`DUPLICATE` só é contada como importada quando encontra o lead da mesma
organização, fonte e identidade da linha. Os erros usam `upsert` e a migration
`20260722213000_import_row_idempotency` cria a unicidade `(importId, row)`, evitando
duplicação de erros e mantendo os contadores finais estáveis no retry.

## Confirmação dos quatro apontamentos anteriores

1. **Limite de linhas:** corrigido em parser e preview, com teste acima do limite.
2. **Valores não-string no mapping:** corrigidos no DTO e na validação defensiva
   do serviço, com cobertura para número, objeto e array.
3. **Retries/counters:** falhas transitórias são repropagadas; erros por linha e
   identidades de lead são idempotentes, com teste de reexecução.
4. **Fonte dos leads:** candidatos CSV agora persistem `CSV_IMPORT`, coberto em
   teste.

## Verificação executada

```text
npm exec jest -- src/modules/imports --runInBand
PASS: 4 suítes, 22 testes

npm run typecheck
PASS

npm run build
PASS
```

## Severidade consolidada

- Critical: nenhum.
- Important: nenhum.
- Minor: nenhum.

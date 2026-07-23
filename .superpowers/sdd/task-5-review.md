# Revisão — Task 5: fluxo web de pesquisa

**Veredito: `APPROVED`**

Escopo conferido: `Global Constraints`, `Task 5`, especificação de interface,
relatório da task, contratos/rotas reais do módulo `prospecting`, tipos, hooks,
página, componentes compartilhados e testes. Esta revisão não alterou código de
produção.

## Gate 1 — Conformidade com a especificação

**Aprovado.** O cliente consome os cinco endpoints versionados sob `/api/v1`,
envia os campos e `resultIds` esperados pelo controller e interpreta corretamente
o contrato `{ data, meta }` das listagens. Formulário, filtro padrão sem site,
histórico com estados, polling a cada dois segundos somente em `PENDING` e
`PROCESSING`, tabela, paginação, resumo de importação, rota `/search` e bloqueio
de resultados já importados estão presentes.

Falhas de criação/importação e agora também de carregamento de histórico ou
resultados usam mensagens sanitizadas. Os estados de consulta com erro oferecem
um botão acessível de retry em vez de comunicar falsamente uma lista vazia.

## Gate 2 — Qualidade e correção

**Aprovado.** A query de resultados deixou de reutilizar `placeholderData` na
troca de página. Durante o carregamento da página solicitada, a tela mostra um
skeleton; resultados anteriores não permanecem selecionáveis nem podem ser
enviados ao endpoint de importação. A seleção continua limitada à página atual e
é limpa ao mudar de pesquisa ou página; select-all ignora `importedLeadId` e
linhas importadas seguem desabilitadas.

## Confirmação dos dois apontamentos anteriores

1. **Estados de erro de consultas:** corrigidos em histórico e resultados, com
   mensagem sanitizada, retry e testes específicos.
2. **Seleção/cache entre páginas:** corrigido pela remoção do placeholder para
   resultados, com teste de segunda página atrasada que confirma a ausência de
   dados antigos durante a transição.

## Pontos positivos verificados

- Polling do item selecionado inicia somente em `PENDING`/`PROCESSING` e para em
  estado terminal, coberto em teste.
- Tabela usa cabeçalhos semânticos; controles possuem labels e foco visível.
- O roteamento existente para `/search` e o menu de navegação foram preservados.
- Não há acesso a backend, Redis ou internet nas suítes web.

## Verificação executada

```text
pnpm --filter @prospectly/web test
PASS: 4 suítes, 13 testes

pnpm --filter @prospectly/web typecheck
PASS

pnpm --filter @prospectly/web lint
PASS

pnpm --filter @prospectly/web build
PASS (aviso não bloqueante: bundle JS de 850.10 kB)
```

## Severidade consolidada

- Critical: nenhum.
- Important: nenhum.
- Minor: nenhum.


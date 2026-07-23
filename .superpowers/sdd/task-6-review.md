# Revisão — Task 6: fluxo web de CSV

**Veredito: APPROVED**

Escopo conferido: Global Constraints, Task 6, especificação da interface CSV,
relatório da task, contratos/rotas reais do módulo imports, tipos, hooks, página,
rota/sidebar e testes. Esta revisão não alterou código de produção.

## Gate 1 — Conformidade com a especificação

**Aprovado.** Preview e criação agora enviam FormData real nos campos file e
mapping esperados pelo FileInterceptor e pelo DTO do backend. As requisições
multipart bloqueiam o header JSON herdado da instância Axios e deixam o browser
fornecer o boundary. O teste com adapter real prova, após o pipeline Axios, body
FormData e content-type false; a validação independente reproduziu o mesmo
resultado.

A tela mantém arquivo CSV, prévia de cinco linhas, mapping sugerido/editável,
confirmação explícita com companyName obrigatório e reset do input somente após
criar o job com sucesso. Rota protegida /imports e o item de sidebar foram
adicionados sem regressão.

## Gate 2 — Qualidade, polling e operação

**Aprovado.** Histórico e erros por linha possuem paginações independentes
baseadas no meta do backend; a página de erros é resetada ao mudar/criar uma
importação. Falhas de carregamento recebem estados sanitizados e retry acessível.
O job selecionado faz polling a cada dois segundos somente enquanto PENDING ou
PROCESSING e para em estado terminal. A mensagem de FAILED não informa mais,
incorretamente, que o processamento foi concluído.

Não há URL.createObjectURL, portanto não há URL de memória pendente de revogação.

## Confirmação dos apontamentos anteriores

1. **Multipart real:** corrigido com Content-Type false na requisição e coberto
   por teste após a transformação Axios.
2. **Paginação:** corrigida para histórico e erros por linha, com testes de
   páginas independentes.
3. **Erros de consulta:** corrigidos com estados de erro/retry para ambos os
   endpoints.
4. **Cópia FAILED:** corrigida para uma descrição específica de falha.

## Bundle warning

O build permanece funcional, mas o bundle inicial está em 861.62 kB não
comprimidos (249.97 kB gzip), acima do aviso Vite de 500 kB. É uma preocupação
de performance não bloqueante para esta task; code splitting de rotas deve ser
tratado em trabalho dedicado e validado de forma ampla.

## Verificação executada

    pnpm --filter @prospectly/web test
    PASS: 9 suítes, 29 testes

    pnpm --filter @prospectly/web typecheck
    PASS

    pnpm --filter @prospectly/web lint
    PASS

    pnpm --filter @prospectly/web build
    PASS com aviso não bloqueante de bundle

## Severidade consolidada

- Critical: nenhum.
- Important: nenhum.
- Minor: nenhum.


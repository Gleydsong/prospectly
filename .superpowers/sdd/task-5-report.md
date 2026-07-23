# Task 5 — Fluxo web de pesquisa

## Resultado

**DONE** — a página de Pesquisa agora cria e acompanha buscas OpenStreetMap,
exibe histórico e resultados paginados, permite seleção/importação seletiva e
usa somente os contratos expostos pela Task 3.

## Contratos consumidos

- `POST /searches` recebe `category`, `city`, `state` e
  `onlyWithoutWebsite`.
- `GET /searches` e `GET /searches/:id/results` usam
  `{ data, meta: { page, pageSize, total, totalPages } }`.
- `GET /searches/:id` alimenta o polling da pesquisa selecionada.
- `POST /searches/:id/import` recebe `{ resultIds }` e mostra
  `imported`, `skipped`, `invalid` e `conflicts` retornados pela API.

## TDD

### RED

Antes de criar a implementação, foram adicionados os testes de formulário e
hook e executado:

    pnpm --filter @prospectly/web test -- src/features/prospecting/hooks.test.tsx src/pages/search-page.test.tsx

O resultado foi falha esperada:

- `hooks.test.tsx` não conseguia resolver `./api`, que ainda não existia.
- os três testes de `SearchPage` não encontravam formulário, checkbox nem
  botão, pois a página ainda era o placeholder "Disponível na Fase 3".

Os testes descrevem validação obrigatória de categoria/cidade/UF, filtro
"Somente empresas sem site informado" ativo por padrão, submissão, erro seguro
de API e polling de dois segundos que para após estado terminal.

### GREEN

- Criados `features/prospecting/api.ts` e `hooks.ts` com tipos alinhados ao
  controller/DTOs reais da Task 3.
- Criados tipos de pesquisa, resultado normalizado, presença de website e
  resumo de importação em `src/types/index.ts`.
- A página passou a ter formulário Zod/RHF, histórico com estados, polling de
  pesquisa ativa, tabela paginada, seleção individual/em massa por página,
  bloqueio de resultados importados e resumo de importação.
- A seleção é limpa ao trocar de pesquisa ou página de resultados; o polling
  somente ocorre em `PENDING` ou `PROCESSING` e a tabela é recarregada quando a
  busca chega a `COMPLETED`.
- Labels nativos, foco visível, estados de loading, vazio e erro foram mantidos
  acessíveis; os testes usam mocks, sem backend, Redis ou rede real.

## Arquivos alterados/criados

- `apps/web/src/features/prospecting/api.ts`
- `apps/web/src/features/prospecting/hooks.ts`
- `apps/web/src/features/prospecting/hooks.test.tsx`
- `apps/web/src/pages/search-page.tsx`
- `apps/web/src/pages/search-page.test.tsx`
- `apps/web/src/types/index.ts`
- `.superpowers/sdd/task-5-report.md`

Nenhum arquivo CSV ou pertencente à Task 6 foi alterado.

## Verificação

    pnpm --filter @prospectly/web test
    pnpm --filter @prospectly/web typecheck
    pnpm --filter @prospectly/web lint
    pnpm --filter @prospectly/web build

Resultados finais:

- Testes web completos: 4 suítes, 10 testes aprovados.
- Typecheck: aprovado.
- Lint: aprovado, sem avisos.
- Build Vite: aprovado.
- O Vite manteve o aviso não bloqueante de bundle JavaScript acima de 500 kB
  (849.54 kB não comprimido); não foi introduzida uma mudança de divisão de
  chunks fora do escopo desta task.

## Auto-review

- Os paths, campos obrigatórios, paginação e formato de importação foram
  conferidos contra `prospecting.controller.ts`, seus DTOs e
  `prospecting.service.ts`; não foram criados endpoints ou campos alternativos.
- Polling é limitado a pesquisas ativas e para em `COMPLETED` ou `FAILED`.
- A UI não permite importar resultado já vinculado a `importedLeadId`; a ação
  em massa ignora esses resultados e a seleção não atravessa páginas.
- Falhas de API são exibidas por `getApiErrorMessage`, sem interpolar detalhes
  internos na interface.
- Não há chamadas de backend real nos testes, nem alterações em CSV, imports
  web ou rotas da Task 6.

## Correções após revisão

Os dois apontamentos `Important` de `task-5-review.md` foram corrigidos com
testes adicionais em RED/GREEN.

### RED adicional

1. `SearchPage` recebeu casos que simulam falha em `useSearches` e
   `useSearchResults`. Antes da correção, ambos exibiam um estado vazio sem
   informar falha; os dois testes não encontravam `role="alert"`.
2. `useSearchResults` recebeu uma troca de página com a segunda resposta
   atrasada. Antes da correção, após `rerender({ page: 2 })`, o hook ainda
   devolvia o resultado `result-page-one`, expondo seleção/importação da página
   anterior.

### GREEN adicional

- Histórico e resultados tratam `isError` antes do estado vazio, exibem mensagem
  sanitizada por `getApiErrorMessage` e um botão "Tentar novamente" que chama o
  `refetch` da consulta correspondente.
- `useSearchResults` não usa mais `placeholderData`. Durante a mudança de
  página, `data` fica indisponível e a página exibe skeleton até a resposta da
  página solicitada; logo não há checkbox, seleção ou importação de resultados
  antigos nesse intervalo.

Verificação após as correções:

    pnpm --filter @prospectly/web test
    pnpm --filter @prospectly/web typecheck
    pnpm --filter @prospectly/web lint
    pnpm --filter @prospectly/web build

- Testes web completos: 4 suítes, 13 testes aprovados.
- Typecheck e lint: aprovados, sem avisos.
- Build: aprovado; permanece somente o aviso não bloqueante de chunk JavaScript
  acima de 500 kB (850.10 kB não comprimido).

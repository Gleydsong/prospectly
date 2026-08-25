# Handoff — rollback Appmax, estado do billing e preparação para Asaas

## Metadados

- Data do handoff: 25/08/2026, fuso Europe/Lisbon.
- Repositório: `https://github.com/Gleydsong/prospectly`.
- Worktree auditado: `/Users/guidev/orca/workspaces/prospectly/abacate_pay`.
- Objetivo concluído: remover a integração Appmax da Prospectly, manter AbacatePay somente para PIX, preservar salvaguardas genéricas de billing e preparar uma continuação segura para cartão via Asaas.
- Este documento não contém chaves, tokens, senhas, payloads pessoais ou valores de secrets.

## Resumo executivo — verdade atual

1. Appmax foi removida do runtime, UI, configuração, schema Prisma atual, banco de produção e Render.
2. O baseline funcional do billing é `ab7a2102fd42c53d0b9fd6c89f98c5039c41ec3e`; o commit documental que contém este arquivo é um descendente sem alteração de runtime. Os dois commits funcionais finais são:
   - `f14516e refactor(billing): remove Appmax card gateway`
   - `ab7a210 fix(billing): ignore stale Abacate subscription events`
3. O billing novo está deliberadamente em modo PIX-only com AbacatePay. Cartão retorna erro controlado e permanecerá indisponível até a integração Asaas.
4. Stripe não possui checkout runtime. O enum/identificadores Stripe permanecem somente para rastreabilidade de registros históricos.
5. Na auditoria de produção anterior ao commit documental, o Render estava no commit `ab7a210`, os três serviços ativos estavam `live` e os endpoints públicos essenciais responderam corretamente.
6. A migration compensatória de Appmax está aplicada no PostgreSQL de produção. Não há tabelas, colunas ou valor de enum Appmax ativos.
7. A branch de continuação `Gleydsong/integracao_asaas` foi alinhada ao `origin/main` depois da publicação deste documento e contém uma pesquisa Asaas não versionada que deve ser preservada e atualizada antes da implementação.
8. Nenhum pagamento real foi concluído. O smoke do Browser Harness criou somente uma cobrança PIX pendente e não paga de R$ 14,99.

## Estado exato deste worktree

Worktree:

```text
/Users/guidev/orca/workspaces/prospectly/abacate_pay
```

Estado Git verificado:

```text
baseline funcional: ab7a2102fd42c53d0b9fd6c89f98c5039c41ec3e
HEAD final:          igual a origin/main, no commit documental descendente
status final:        clean
branch final:        nenhuma — detached HEAD em origin/main
```

O `detached HEAD` é intencional: a branch temporária de rollback foi excluída depois que seu conteúdo entrou em `origin/main`. Nenhum código foi perdido. Este worktree pode ser usado para inspeção, mas não deve receber novos commits sem antes executar `git switch -c <nova-branch>`.

O nome físico `abacate_pay` do diretório é apenas o nome antigo do worktree; ele não indica uma branch ativa.

### Situação da branch local `main`

A branch local `main` está presa a outro worktree:

```text
/Users/guidev/orca/workspaces/prospectly/bug-fix
```

Na última inspeção ela estava em `23348f4`, com trabalho próprio, `ahead 1, behind 14` em relação a `origin/main`. Ela não foi alterada nem descartada durante este rollback. Não executar reset ou alinhamento destrutivo nesse worktree sem uma auditoria separada.

### Branches Appmax removidas

Foram excluídas após integração e preservação da parte útil:

- local: `rollback/remove-appmax`
- local: `Gleydsong/abacate_pay`
- remota: `origin/rollback/remove-appmax`
- remota: `origin/Gleydsong/abacate_pay`
- remota: `origin/fix/appmax-failed-monthly-wipes-plan`

O commit Appmax antigo `9fcd32b` continua no histórico Git como ancestral, o que é normal. A exclusão de branches não reescreveu histórico.

## Branch e worktree para Asaas

Usar como continuação:

```text
worktree: /Users/guidev/orca/workspaces/prospectly/integracao_asaas
branch:   Gleydsong/integracao_asaas
HEAD:     igual a origin/main após a integração deste documento
```

Estado preservado:

```text
?? docs/billing/asaas-card-integration-research.md
```

O arquivo possui 373 linhas e é pesquisa, não implementação. Ele está em:

```text
/Users/guidev/orca/workspaces/prospectly/integracao_asaas/docs/billing/asaas-card-integration-research.md
```

Não apagar, sobrescrever ou limpar esse arquivo. Antes de transformá-lo em spec, corrigir as premissas que ficaram desatualizadas após o rollback:

- a seção 2 ainda diz que o roteador envia cartão para Appmax;
- a arquitetura sugerida ainda fala em manter tabelas/campos Appmax;
- o checklist ainda pede auditoria de assinaturas Appmax;
- atualmente não há runtime, registros ou schema Appmax ativos;
- a regra atual é `PIX -> ABACATE`; cartão fica indisponível até `ASAAS` existir.

As conclusões de pesquisa sobre Asaas, webhooks, checkout hospedado, idempotência, chargeback, sandbox e PCI devem ser revalidadas nas fontes oficiais antes da implementação, pois documentação de gateway é mutável.

## Alterações integradas

### Commit `f14516e`

Escopo do diff: 58 arquivos, 356 inserções e 3.276 remoções.

Backend:

- removeu serviço, client HTTP, DTOs, health/install callbacks, rotas e testes específicos da Appmax;
- removeu Appmax do módulo, configuração, validação de ambiente, tenant guard e roteador de pagamentos;
- manteve a fronteira existente de provider para uma futura integração de cartão;
- clientes legados que ainda enviem `paymentMethod=card` recebem `Card payments are temporarily unavailable`;
- AbacatePay rejeita cartão tanto para compra de créditos quanto para assinatura;
- Stripe não voltou a ser usado como fallback de cartão.

Frontend e landing:

- removeu modal Appmax, carregamento de Appmax JS, tipos e estados de confirmação Appmax;
- a página de créditos inicia PIX diretamente;
- removeu CSP/origens Appmax;
- ajustou textos e preços na web e landing;
- removeu documentação antiga de dual gateway/Appmax e criou `docs/billing/payments.md`.

Banco e configuração:

- removeu modelos/campos/enums Appmax do schema Prisma atual;
- removeu variáveis `APPMAX_*` dos exemplos, configuração e `render.yaml`;
- adicionou a migration compensatória `apps/api/prisma/migrations/20260825120000_remove_appmax_gateway/migration.sql`;
- a migration aborta antes de apagar qualquer estrutura se encontrar dado financeiro Appmax;
- o arquivo da migration original `20260824150000_appmax_card_gateway` foi preservado intencionalmente, pois migrations já aplicadas são histórico imutável;
- buscas atuais por `Appmax` em arquivos rastreados encontram somente a migration original e a migration compensatória.

### Commit `ab7a210`

- preservou do branch descartado uma salvaguarda genérica e independente de Appmax;
- webhook atrasado de falha/cancelamento da AbacatePay não revoga um plano se a organização já estiver atribuída a outro provider;
- adicionou cobertura de regressão usando `STRIPE` como provider histórico, evitando reintroduzir Appmax no domínio atual.

## Contrato de billing atual

Fonte canônica local: `docs/billing/payments.md`.

| Produto          |    Preço | Método atual | Provider   |
| ---------------- | -------: | ------------ | ---------- |
| 2.000 créditos   | R$ 14,99 | PIX          | AbacatePay |
| 5.000 créditos   | R$ 23,99 | PIX          | AbacatePay |
| Ilimitado mensal | R$ 49,99 | PIX          | AbacatePay |

Propriedades de segurança preservadas:

- benefício somente após webhook AbacatePay autenticado e verificado;
- tentativa mensal durável para impedir criação concorrente duplicada;
- eventos de webhook possuem tratamento idempotente;
- URL de retorno/checkout não concede benefício por si só;
- cartão não cai silenciosamente em Stripe ou AbacatePay;
- webhook AbacatePay antigo não pode apagar entitlement pertencente a outro provider.

## Banco de produção

Instância Render:

```text
dpg-da2dahbncjis739j2s70-a
```

Antes da remoção foi executado preflight e todos os contadores Appmax estavam em zero: tentativas, instalações, organizações, compras, eventos de webhook e tentativas mensais.

A migration foi aplicada atomicamente e registrada no Prisma:

```text
migration:           20260825120000_remove_appmax_gateway
finished_at:         2026-08-24 23:34:25.401227+00
rolled_back_at:      NULL
applied_steps_count: 1
```

Consulta de catálogo repetida em 25/08/2026 confirmou:

```text
rollback_migration_applied:         true
AppmaxCheckoutAttempt existe:       false
AppmaxInstallation existe:          false
PaymentProvider contém APPMAX:      false
PaymentProvider atual:              STRIPE, ABACATE
```

O MCP PostgreSQL do Render falha nessa máquina com `SSL/TLS required`/`unexpected EOF`. O fallback funcional é o Render CLI com o `psql` do Homebrew em `/opt/homebrew/opt/libpq/bin/psql`. Não registrar connection string ou credenciais em documentos/comandos versionados.

## Render atual

Workspace confirmado:

```text
id:   tea-d4u5oa63jp1c73fuknh0
nome: My Workspace
```

Serviços ativos relevantes na auditoria anterior ao commit documental:

| Serviço | ID                         | URL                                    | Deploy                     | Estado                   |
| ------- | -------------------------- | -------------------------------------- | -------------------------- | ------------------------ |
| API     | `srv-da2dbqugekts73b4ma40` | `https://prospectly-api.onrender.com`  | `dep-da6d8cegekts739cbbi0` | `live`, commit `ab7a210` |
| Web     | `srv-da2dc16gekts73b4mtlg` | `https://prospectly-web.onrender.com`  | `dep-da6d8cegekts739cbc6g` | `live`, commit `ab7a210` |
| Landing | `srv-d9ql5njm8hqs738m8bu0` | `https://prospectly-d34m.onrender.com` | `dep-da6d6m4s728c73blccrg` | `live`, commit `ab7a210` |

Todos estão ligados à branch `main`. API e web usam `checksPass`; o serviço landing usa trigger por commit.

Como este handoff entrou por um commit somente de documentação, o Render pode passar a exibir o SHA documental mais novo depois do auto-deploy. O baseline de runtime continua sendo `ab7a210`; compare o diff antes de interpretar a mudança de SHA como alteração funcional.

Validação HTTP mais recente:

```text
GET /health/ready                         200, {"status":"ready", ...}
GET https://prospectly-web.onrender.com/  200
GET https://prospectly-d34m.onrender.com/ 200 após cold start de ~27 s
GET /api/v1/billing/appmax/health         404
GET /api/v1/billing/card/config           404
```

Logs entre `2026-08-24T23:32:50Z` e `2026-08-24T23:55:37Z`:

- API: nenhum log de nível `error`;
- landing: nenhum log de nível `error`;
- web estático: consulta indisponível por erro temporário `Loki 502/503`, portanto ausência de erros não foi comprovada por logs; o HTTP 200 foi comprovado.

Uma consulta ampla de sete dias mostrou erros anteriores ao rollback, incluindo falhas de registro/auth Prisma em 19/08 e respostas PIX 503 em 23/08. Eles não reapareceram no intervalo pós-deploy acima e não foram diagnosticados neste trabalho. Não os atribuir ao rollback sem uma investigação separada.

### Variáveis Render

O Browser Harness foi usado com a sessão já autenticada no Dashboard Render. As seguintes chaves foram removidas do serviço API com `Save only`:

- `APPMAX_API_BASE_URL`
- `APPMAX_AUTH_BASE_URL`
- `APPMAX_ENABLED`
- `APPMAX_HTTP_TIMEOUT_MS`
- `APPMAX_RECONCILE_INTERVAL_MS`

Depois da gravação, o filtro `APPMAX_` retornou lista vazia. Não existiam chaves Appmax de client ID/secret no serviço inspecionado. Nenhum valor foi copiado ou registrado.

`render blueprints validate` ainda retorna erros `need_payment_info` associados aos planos/database atuais do workspace. Essa validação administrativa do Blueprint não passou, mas os serviços existentes foram implantados e estão `live`. Tratar isso como pendência separada antes de uma recriação completa via Blueprint.

## Browser smoke de PIX

Browser Harness foi utilizado no app autenticado em produção:

- página de créditos mostrou somente PIX;
- não havia opção/texto funcional de cartão ou Appmax;
- preços exibidos: R$ 14,99, R$ 23,99 e R$ 49,99;
- clicar em comprar o pacote menor criou checkout PIX `UNPAID`;
- houve navegação para `/billing/pix`;
- QR Code, copia-e-cola, valor R$ 14,99 e estado “Aguardando confirmação do pagamento” foram exibidos.

Essa cobrança não foi paga. O teste comprova criação e apresentação do PIX, não liquidação, webhook de pagamento real ou concessão real de benefício.

## Validações realizadas

Localmente:

- testes direcionados API: 51 aprovados;
- spec Abacate repetida após o guard final: 21 aprovados;
- testes direcionados web: 25 aprovados;
- suíte completa API: 86 suites, 502 testes aprovados e 6 ignorados;
- suíte completa web: 42 arquivos, 146 testes aprovados;
- typecheck: aprovado;
- build: aprovado;
- Prisma schema validate: aprovado com URL PostgreSQL descartável/dummy apenas para validação;
- lint: sem erros; permanece um warning preexistente em `apps/web/src/pages/dashboard-page.tsx:72`.

CI GitHub:

```text
run:        32789416613
URL:        https://github.com/Gleydsong/prospectly/actions/runs/32789416613
head SHA:   ab7a2102fd42c53d0b9fd6c89f98c5039c41ec3e
conclusion: success
jobs:       quality=success, rls=success
```

O job RLS aplicou todas as migrations em PostgreSQL descartável e verificou row-level security.

## Limites e pendências reais

1. Cartão está indisponível até a integração Asaas. Isso é comportamento deliberado, não bug do checkout PIX.
2. AbacatePay continua responsável somente por PIX. A liberação/compliance comercial de produção do gateway permanece uma dependência externa informada pelo usuário; este trabalho não concluiu pagamento real.
3. Nenhuma implementação Asaas foi realizada ainda.
4. O documento de pesquisa Asaas é bom ponto de partida, mas possui premissas Appmax desatualizadas e deve ser revisado antes da spec.
5. Não houve desinstalação ou exclusão de eventual aplicativo/produto diretamente no painel externo da Appmax. O rollback comprovado cobre código, GitHub, Render e banco da Prospectly.
6. A consulta de logs do site estático no Render estava temporariamente indisponível; somente o smoke HTTP 200 foi confirmado.
7. A validação completa do Blueprint continua bloqueada por `need_payment_info`, apesar dos deploys existentes estarem saudáveis.
8. O worktree local que possui a branch `main` contém estado próprio e divergente. Não usar `reset --hard`, não apagar e não tentar reaproveitá-lo para Asaas.

## Próxima sessão recomendada — integração Asaas

1. Entrar em `/Users/guidev/orca/workspaces/prospectly/integracao_asaas`.
2. Confirmar que `git status` mostra somente o documento de pesquisa não versionado.
3. Revalidar a documentação oficial Asaas, principalmente Checkout hospedado, assinaturas recorrentes, webhooks, idempotência, cancelamento, estorno, chargeback e sandbox.
4. Atualizar as premissas Appmax desatualizadas no documento de pesquisa sem apagar conclusões ainda válidas.
5. Resolver decisões de produto antes de implementar:
   - cartão de crédito somente ou crédito + débito hospedado;
   - tratamento de refund/chargeback quando créditos já foram consumidos;
   - período de tolerância de assinatura recusada/atrasada;
   - dados obrigatórios CPF/CNPJ e telefone;
   - política de notificações do Asaas;
   - recuperação após timeout quando criação externa não oferece idempotency key inequívoca.
6. Produzir spec e tickets verticais antes do código.
7. Manter PIX AbacatePay intacto; adicionar Asaas atrás da fronteira de provider.
8. Conceder/revogar benefícios somente após webhook autenticado e consulta autoritativa ao Asaas.
9. Criar migration aditiva e compatível; nunca editar migrations já aplicadas.
10. Configurar secrets no Render somente pelo Dashboard/secret manager, com `ASAAS_ENABLED=false` até concluir sandbox.
11. Validar aprovado, recusado, timeout, duplicata, evento fora de ordem, reconciliação, cancelamento, refund e chargeback antes do go-live.

## Suggested skills

O próximo agente deve chamar estas skills conforme a fase:

- `research`: revalidar contratos oficiais e OpenAPI Asaas.
- `grill-with-docs`: esclarecer regras de negócio ainda abertas usando o repositório e a pesquisa.
- `domain-modeling`: estabilizar termos como cobrança, checkout, assinatura, entitlement, refund e chargeback.
- `to-spec`: converter decisões confirmadas em especificação implementável.
- `to-tickets`: decompor a spec em slices verticais.
- `implement` e `tdd`: implementar o fluxo aprovado com testes comportamentais.
- `code-review`: revisar spec compliance, segurança, idempotência e regressões.
- `wizard`: conduzir ações humanas de Sandbox, produção, chaves e painel Asaas sem inventar credenciais.
- `browser-harness`: validar o checkout hospedado e os retornos no navegador.
- `render-env-vars`, `render-deploy` e `render-monitor`: configurar, implantar e observar o rollout no Render.

## Arquivos e artefatos de referência

- `docs/billing/payments.md` — contrato vigente PIX-only.
- `apps/api/prisma/migrations/20260825120000_remove_appmax_gateway/migration.sql` — rollback seguro do schema.
- `apps/api/src/modules/billing/infrastructure/abacate.payment-provider.ts` — adapter e guard contra eventos obsoletos.
- `apps/api/src/modules/billing/billing.service.ts` — rejeição controlada de cartão.
- `apps/api/src/modules/billing/domain/payment-router.ts` — fronteira atual de roteamento.
- `apps/web/src/pages/credits-page.tsx` — entrada PIX atual.
- `render.yaml` — Blueprint sem Appmax.
- `/Users/guidev/orca/workspaces/prospectly/integracao_asaas/docs/billing/asaas-card-integration-research.md` — pesquisa Asaas não versionada e parcialmente desatualizada.
- `https://github.com/Gleydsong/prospectly/actions/runs/32789416613` — evidência de CI.

## Comandos seguros para retomar

```bash
cd /Users/guidev/orca/workspaces/prospectly/integracao_asaas
git status --short --branch
git log -3 --oneline --decorate
git rev-parse HEAD
git rev-parse origin/main
```

Resultado esperado: branch `Gleydsong/integracao_asaas`, HEAD igual a `origin/main`, contendo `ab7a210` como baseline funcional e apenas `docs/billing/asaas-card-integration-research.md` não versionado.

Não executar comandos destrutivos ou limpar arquivos não versionados. Não desenvolver diretamente no worktree `abacate_pay` enquanto ele estiver em detached HEAD.

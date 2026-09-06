# Prompt para Grok — upgrade operacional inspirado no Attio

Copie todo o conteúdo abaixo para o Grok.

---

Você atua como principal engineer e coordenador de uma iniciativa grande no
repositório `Gleydsong/prospectly`.

Objetivo: adicionar ao Prospectly uma camada operacional inspirada nas melhores
capacidades do Attio, sem copiar o produto, sem perder o foco em prospecção local
e sem implementar tudo num único PR.

## Modo e roteamento obrigatórios

1. Ative `/caveman full` para updates, perguntas, resumos e handoffs. Preserve
   escrita normal em specs, tickets, código, testes, migrations, commits e PRs.
2. Invoque `/ask-matt` antes de escolher o fluxo.
3. Este é um upgrade grande e multi-sessão. Rota esperada do router:
   `/wayfinder`, depois `/to-spec`, `/to-tickets` e `/implement` por ticket.
4. Use `/domain-modeling` para resolver termos; `/codebase-design` para módulos e
   seams; `/tdd` em cada comportamento; `/code-review` antes de commit.
5. Se algum skill não existir, informe nome exato. Não improvise fingindo que o
   invocou.
6. Mantenha descoberta, decisões, spec e tickets na mesma janela até
   `/to-tickets`. Depois implemente tickets em contextos limpos, blockers-first.

Não comece implementação imediatamente. Primeiro investigue e produza mapa de
decisões, spec e tickets. Pare nos gates descritos abaixo quando decisão humana
for necessária.

## Fontes obrigatórias

Leia integralmente:

- `AGENTS.md` e instruções aninhadas;
- `README.md`;
- `CONTEXT-MAP.md`;
- `docs/agents/**`;
- `docs/adr/**`;
- `docs/architecture/**`;
- `docs/saas-mvp/**`;
- `docs/privacy/**` relevantes;
- `docs/deploy/render.md`;
- `docs/deploy/workers.md`;
- `docs/ops/runbook.md`;
- `docs/superpowers/reports/2026-09-03-attio-vs-prospectly-production.md`.

Consulte fontes oficiais atuais do Attio apontadas nesse relatório. Trate o
Attio como referência de comportamento, não arquitetura a copiar.

## Baseline confirmado de produção

Use como ponto inicial, depois revalide porque produção pode mudar:

```text
Commit: 4b3f7b563f4ebbd6dbfb12af9e1c0a5d7d7dea52
PR: #98
CI: quality SUCCESS, rls SUCCESS
Web: https://app.prospectlyonboard.com
Landing: https://prospectlyonboard.com
API: https://prospectly-api.onrender.com
Health: GET /health/ready = 200 em 2026-09-03
```

Render observado:

- API: 1 instância, 0,5 CPU, 512 MB;
- PostgreSQL 16: 0,1 CPU, 256 MB, 1 GB, sem connection pool;
- Redis 8.1 free: `noeviction`, persistência desativada;
- sem background worker separado; workers carregam no processo da API;
- 17 conexões PostgreSQL e 25 Redis no fim do snapshot consultado;
- log histórico de 2026-08-29: `Prisma P2028: Unable to start a transaction in
  the given time` no dashboard;
- sem erros encontrados na janela imediatamente posterior ao deploy atual;
- consulta SQL via conector Render falhou por requisito SSL/TLS; volumes e
  migrations aplicadas continuam não confirmados;
- `api.prospectlyonboard.com` não resolve; API usa host `onrender.com`.

Não trate `live`, health 200, merge, CI verde ou código em `main` como provas
equivalentes. Confirme cada gate separadamente.

## Produto atual que deve ser preservado

- busca OpenStreetMap e Google Places;
- Opportunity Finder;
- importação CSV e deduplicação;
- leads, contactos, tags, responsável e pipeline;
- análise de website e scoring;
- atividades e tarefas;
- campanhas e templates;
- agentes assistidos de CRM e WhatsApp;
- créditos e billing;
- autenticação, organizações, RBAC, RLS e auditoria;
- LGPD, suppression e `doNotContact`;
- multi-tenancy sempre derivada da sessão;
- `AiRun`, limites e consumo de créditos;
- payload persistido/reconciliador nos fluxos assíncronos existentes;
- Conversion Studio e demais módulos fora desta iniciativa não podem regredir.

## Regras inegociáveis

- Nunca automatize cold outreach.
- IA pode pesquisar, classificar, resumir e gerar rascunho. Envio externo exige
  ação humana explícita.
- `doNotContact`, suppression, consentimento e políticas LGPD vencem qualquer
  workflow/cadência.
- Nunca aceite `organizationId`, papel ou tenant vindos do cliente.
- Preserve RLS, RBAC, audit log e isolamento entre organizações.
- Não logue tokens, conteúdo sensível de e-mails ou prompts com PII.
- Não mexa em Asaas, AbacatePay histórico, Stripe legado, benefícios, créditos
  ou ledger fora das integrações mínimas de consumo já existentes.
- Não faça refactor oportunista.
- Não crie plataforma genérica de objetos ilimitados.
- Não dependa de Redis como única fonte de verdade.
- Não execute migration/deploy de produção, altere env vars, DNS, serviços ou
  planos sem autorização separada.
- Não descarte alterações locais do utilizador.

## Resultado de produto

Construir por releases independentes:

### Release 1 — eventos duráveis

Eventos mínimos:

- `lead.created`;
- `lead.imported`;
- `lead.updated` somente para alterações relevantes;
- `lead.score_changed`;
- `lead.stage_changed`;
- `lead.assigned`;
- `lead.activity_created`;
- `website_analysis.completed`;
- `campaign.result_recorded`;
- `task.overdue` via scan idempotente.

Requisitos:

- event ID estável;
- `organizationId`, aggregate type/id, actor, correlation ID, timestamp, schema
  version e payload mínimo;
- persistência atômica com escrita de negócio via transactional outbox;
- publicação BullMQ recuperável;
- consumidor idempotente;
- reconciliador;
- retenção definida;
- auditoria sem duplicar conteúdo sensível;
- índices e plano de volume.

Antes de implementar, compare `AuditLog`, `LeadActivity`, `CampaignActivity`,
jobs persistidos e padrões de outbox existentes. Não crie conceitos duplicados.

### Release 2 — listas inteligentes

Entidade/view salva para `Lead` inicialmente:

- nome e descrição;
- proprietário;
- visibilidade privada/equipa;
- filtros aninhados `AND/OR` sobre allowlist;
- ordenações múltiplas;
- colunas e ordem;
- tabela ou Kanban;
- filtros relativos de tempo;
- paginação estável;
- URL compartilhável dentro da organização;
- preview de contagem;
- duplicar, editar, arquivar e apagar;
- usar view em campanha, relatório e workflow.

Reaproveite filtros existentes da API. Valide AST de filtros no servidor. Proíba
SQL, campos arbitrários, JSONPath livre e acesso cross-tenant.

### Release 3 — workflows v1

Não comece por canvas. Editor em formulário acessível e responsivo.

Modelo esperado, sujeito ao design aprovado:

- definição;
- versão imutável publicada;
- trigger;
- steps tipados;
- run;
- step run;
- estado `DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`;
- outcome `SUCCESS`, `FAILED`, `PARTIAL`, `SKIPPED`, `REVIEW_REQUIRED`.

Gatilhos:

- eventos da Release 1;
- entrada/saída de lista inteligente;
- recorrência;
- execução manual.

Condições:

- filtros da view;
- `if` simples;
- combinação `all`/`any`;
- cooldown e deduplicação.

Ações iniciais:

- adicionar/remover tag;
- atribuir responsável;
- round-robin transacional;
- mover etapa;
- criar tarefa;
- definir próximo contacto;
- incluir em campanha;
- gerar sugestão de CRM ou WhatsApp;
- webhook assinado.

Obrigatório:

- preview e dry-run;
- estimativa/limite de créditos;
- permissões explícitas por ação;
- idempotency key por step;
- timeout, retry e backoff;
- estado terminal e revisão manual;
- histórico sanitizado;
- versionamento sem alterar runs existentes;
- pause imediato de novos runs;
- prevenção de loops;
- limite de concorrência por organização;
- observabilidade e métricas.

Exemplo de aceitação:

```text
Quando website_analysis.completed
Se score >= 70, websitePresence = NO_WEBSITE_REPORTED e doNotContact = false
Então adicionar tag Alto potencial, mover para Qualificado, atribuir por
round-robin, criar tarefa para amanhã e gerar rascunho de primeira abordagem.
Nenhuma mensagem é enviada.
Reprocessar mesmo evento não duplica tag, movimento, tarefa nem débito.
```

### Release 4 — reporting histórico

Relatórios:

- funil;
- tempo em etapa;
- mudanças por período;
- conversão por origem/segmento/responsável;
- velocidade de follow-up;
- oportunidades de score alto sem ação;
- drill-down paginado e tenant-safe.

Dashboards podem compor tipos fechados de relatório. Não aceite SQL arbitrário.
Queries precisam de índices, limites, timeout e teste com volume representativo.

### Release 5 — cadências assistidas

Cadência usa campanha, template, tarefa e agente existentes:

```text
Dia 0: rascunho para aprovação
Dia 3: tarefa de follow-up
Dia 7: novo rascunho para aprovação
Resposta, reunião, opt-out, suppression ou doNotContact: encerrar
```

Não enviar e-mail, WhatsApp ou LinkedIn automaticamente. Não afirmar que houve
resposta/reunião sem fonte integrada ou registo humano.

### Release 6 — campos personalizados e IA

Escopo inicial: `Lead` e `LeadContact`.

Tipos permitidos: texto, número, data, boolean, select, multiselect, URL e moeda.
Definir estratégia de armazenamento e índices antes de implementar. Campos devem
funcionar em views, import/export, workflows e relatórios.

Campos IA:

- resumo;
- classificação;
- prompt estruturado;
- pesquisa web;
- execução individual, em lote ou por workflow;
- fonte, timestamp, confiança, custo e versão do prompt/modelo;
- distinção entre fato observado e inferência;
- preview e confirmação quando a saída mudar estado comercial.

### Release 7 — relacionamento e integrações

E-mail/calendário:

- começar por Gmail/Google Calendar;
- avaliar Microsoft depois;
- OAuth com scopes mínimos;
- tokens criptografados e rotacionáveis;
- sync cursor e webhook renovável;
- metadados primeiro;
- privacidade por padrão;
- ligação determinística por endereço/participante;
- desconectar e apagar dados;
- `lastContactAt` e timeline deriváveis;
- reunião concluída pode sugerir tarefa, não criá-la sem workflow autorizado.

Webhooks/API:

- subscriptions por evento;
- HMAC SHA-256;
- timestamp e proteção contra replay;
- idempotency key;
- outbox;
- filtros allowlisted;
- retries e dead-letter;
- histórico e botão de teste;
- OAuth/API tokens com scopes, expiração e revogação.

MCP é fase posterior. Primeiro estabilize API e permissões.

## Decisões que `/wayfinder` deve resolver

Crie decision tickets com dependências explícitas para:

1. `AuditLog` versus `DomainEvent` versus outbox.
2. JSON versionado versus tabelas normalizadas para workflow definition.
3. Motor de filtros compartilhado entre leads, views, workflows e reports.
4. Histórico de etapa: evento genérico versus tabela de fatos dedicada.
5. Executor no processo API versus background worker separado.
6. Estratégia durável com Redis sem persistência.
7. Limite de conexões Prisma/PostgreSQL e prevenção do `P2028`.
8. Modelo de permissões de views/workflows/dashboards.
9. Contabilização de créditos em IA e rollback/compensação.
10. Prevenção de loops e tempestades de eventos.
11. Representação, validação e indexação de campos personalizados.
12. Retenção, consentimento e visibilidade de comunicações sincronizadas.
13. Domínio próprio da API e implicações para OAuth/cookies/CORS.
14. Estratégia de rollout, feature flags e backward compatibility.

Cada decisão deve registrar contexto, opções, trade-offs, decisão e consequências
em `CONTEXT.md`/ADR conforme regras do repositório.

## Tickets

Use GitHub Issues `Gleydsong/prospectly`, conforme
`docs/agents/issue-tracker.md`. Use labels canônicos. `/to-tickets` deve criar
tracer bullets verticais, nunca tickets horizontais como “fazer todo backend”.

Cada ticket inclui:

- comportamento de ponta a ponta;
- dependências e blockers nativos;
- arquivos/módulos prováveis;
- contrato API e UI;
- migration aditiva;
- ameaça e privacidade;
- testes RED/GREEN;
- observabilidade;
- rollback/feature flag;
- critérios de aceitação;
- comandos de validação;
- mudanças proibidas.

Não abra Issues duplicadas. Pesquise abertas, fechadas e PRs relacionados antes.

## Estratégia de implementação

- Um ticket/branch/PR coeso.
- Prefixo padrão de branch do ambiente; respeite regra local se diferente.
- TDD por seam público.
- Não teste métodos privados.
- Migrations aditivas, compatíveis com versão anterior e com rollback lógico.
- Todo novo modelo tenant-owned precisa de RLS e testes reais PostgreSQL.
- APIs com DTO estrito, paginação, limites e autorização server-side.
- Jobs com payload mínimo, correlation ID e deduplicação.
- UI com loading, empty, error, retry, disabled, keyboard, mobile e reduced motion.
- PT-BR e EN completos.
- Instrumente antes de otimizar.

## Gates obrigatórios por ticket

Execute comandos estabelecidos pelo repositório. No mínimo, quando aplicável:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:generate
pnpm db:validate
pnpm audit --audit-level=high
git diff --check
```

Além disso:

- testes focados do comportamento;
- testes HTTP/integration;
- testes RLS com PostgreSQL real;
- teste de idempotência e retry;
- teste de concorrência para round-robin/outbox;
- Playwright desktop e mobile para fluxos novos;
- inspeção de diff e `git status`;
- code review em eixos Standards e Spec.

Se algum comando não existir, descubra equivalente no `package.json`. Nunca
invente aprovação. Nunca diga que passou sem executar.

## Gate de produção

Antes de qualquer rollout remoto:

1. confirmar commit e migrations;
2. testar migration em cópia representativa;
3. decidir/ter capacidade de worker;
4. rever PostgreSQL connections e pool;
5. validar Redis e recuperação sem persistência;
6. estabelecer feature flags por organização;
7. ativar em organização interna/canário;
8. medir erros, latência, fila, retries e DB;
9. rollback sem apagar dados;
10. obter autorização humana separada para deploy e migration.

## Relatório de cada sessão

Formato curto por causa do `/caveman full`:

```text
Estado:
Decisões:
Arquivos alterados:
Testes:
Riscos:
Bloqueios:
Próximo ticket:
Deploy/migration: não executado | executado com autorização e evidência
```

## Primeira resposta esperada

Não implemente. Entregue:

1. confirmação dos skills encontrados;
2. resultado do `/ask-matt`;
3. checkout/worktree/branch/status;
4. comparação entre produção atual e commit local;
5. inventário dos padrões reaproveitáveis;
6. mapa inicial de decisões com blockers;
7. perguntas humanas mínimas que impedem decisões irreversíveis;
8. recomendação do primeiro tracer bullet.

---

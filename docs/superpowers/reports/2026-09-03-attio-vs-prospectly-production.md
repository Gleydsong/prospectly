# Attio vs. Prospectly em produção — 2026-09-03

## Objetivo

Comparar funcionalidades atuais do Attio com o Prospectly realmente publicado,
separando:

- capacidade confirmada em produção;
- capacidade presente apenas no código;
- lacuna funcional;
- dependência operacional necessária antes de ampliar o produto.

Análise somente leitura. Nenhum deploy, configuração, dado ou código de produto
foi alterado.

## Fontes

### Attio

Fontes primárias:

- [Página analisada](https://attio.com/pt/p/crm-eu-security-1302-26#features)
- [Modelo de dados](https://attio.com/help/reference/attio-101/attios-data-model/define-your-data-model-objects-lists-and-views)
- [Views](https://attio.com/help/reference/managing-your-data/views/create-and-manage-table-views)
- [Filtros e ordenação](https://attio.com/help/reference/managing-your-data/views/filter-and-sort-views)
- [Workflows](https://attio.com/help/reference/automations/workflows/overview-of-workflows)
- [Blocos de workflows](https://attio.com/help/reference/automations/workflows/workflows-block-library)
- [Relatórios](https://attio.com/help/reference/managing-your-data/dashboard-and-reports/reports)
- [Dashboards](https://attio.com/help/reference/managing-your-data/dashboard-and-reports/dashboards)
- [E-mail e calendário](https://attio.com/help/reference/email-calendar/email-and-calendar-syncing)
- [AI Attributes](https://attio.com/help/reference/attio-ai/ai-attributes)
- [Ask Attio](https://attio.com/help/reference/attio-ai/ask-attio/chat-with-ask-attio)
- [Sequences](https://attio.com/help/reference/automations/sequences/create-a-sequence)
- [Apps](https://attio.com/help/reference/apps)
- [Webhooks](https://docs.attio.com/rest-api/guides/webhooks)
- [Notas](https://attio.com/help/reference/productivity-collaborating/notes)
- [Comentários e menções](https://attio.com/help/reference/productivity-collaborating/comments-and-mentions)
- [Call Intelligence](https://attio.com/help/reference/productivity-collaborating/call-intelligence/enable-call-recording)

### Prospectly

Evidência primária:

- Render: serviços, deploys, métricas e logs;
- GitHub: `main`, PR #98 e checks;
- páginas e endpoints públicos;
- código exato do commit publicado.

## Baseline confirmado de produção

Commit publicado nos três serviços ativos:

```text
4b3f7b563f4ebbd6dbfb12af9e1c0a5d7d7dea52
feat(mail): padronizar e-mails transacionais no design system HTML (#98)
```

PR #98 foi mesclado em 2026-09-03. Checks `quality` e `rls`: `SUCCESS`.

Serviços ativos:

| Serviço | Tipo | URL Render | Estado | Capacidade |
|---|---|---|---|---|
| `prospectly-web` | static site | `https://prospectly-web.onrender.com` | live | CDN estático |
| `prospectly-api` | web service | `https://prospectly-api.onrender.com` | live | 1 instância, 0,5 CPU, 512 MB |
| `prospectly` | landing Next.js | `https://prospectly-d34m.onrender.com` | live | plano free |

Domínios verificados:

- `https://app.prospectlyonboard.com`: HTTP 200, redireciona visitante sem
  sessão para `/login`;
- `https://prospectlyonboard.com`: HTTP 200;
- `https://www.prospectlyonboard.com`: HTTP 301 para domínio raiz;
- `https://api.prospectlyonboard.com`: não resolve; app usa API Render.

API:

- `GET /health/ready`: HTTP 200;
- endpoint protegido sem token: HTTP 401, comportamento esperado;
- Swagger não está público: `/api/docs` e `/api/docs-json` retornam 404;
- nenhuma entrada `error` apareceu no intervalo posterior ao deploy consultado.

Infra de dados:

| Recurso | Estado observado |
|---|---|
| PostgreSQL 16 | disponível, 0,1 CPU, 256 MB, 1 GB, sem connection pool |
| Redis 8.1 | disponível, plano free, `noeviction`, persistência desativada |
| Worker | não existe serviço separado; `WorkersModule` inicia dentro da API |

Snapshot de métricas após deploy:

- API: cerca de 150–153 MB de memória, CPU baixa;
- PostgreSQL: 17 conexões ativas no fim da janela observada;
- Redis: 25 conexões, cerca de 4,3 MB;
- tráfego baixo na janela.

Risco histórico relevante: logs de 2026-08-29 mostram dashboard HTTP 500 com
`Prisma P2028: Unable to start a transaction in the given time`. Também houve
503 em operações de billing antes dos reparos posteriores. Não houve repetição
confirmada depois do deploy atual na janela consultada.

Limite da verificação: consulta agregada direta ao PostgreSQL via conector Render
falhou porque a conexão exigiu SSL/TLS. Portanto quantidade de registos e lista
efetiva de migrations aplicadas não foram confirmadas nesta análise. Health 200
prova conectividade da aplicação, não o conteúdo do banco.

## Produto realmente publicado

A landing promete e a tela de login confirma foco estreito:

- busca por categoria e cidade;
- OpenStreetMap e Google Places;
- identificação de empresas sem website reportado;
- lista de leads, pipeline e CSV;
- score, diagnóstico, tarefas e abordagem contextual;
- créditos e assinatura;
- autenticação por senha e Google;
- LGPD.

Rotas publicadas no frontend:

- dashboard;
- busca e importação CSV;
- leads e detalhe;
- pipeline;
- Opportunity Finder;
- agentes CRM e WhatsApp;
- tarefas;
- campanhas e templates;
- créditos/billing;
- configurações, integrações e privacidade.

Modelos publicados confirmam `Lead`, `LeadContact`, tags, atividades, tarefas,
pipeline, análise de website, scoring, pesquisas, Opportunity Finder, `AiRun`,
imports, campanhas, templates, integração, tokens de plugin, auditoria, billing,
privacidade e usage ledger.

### O que já existe e deve ser reaproveitado

- multi-tenancy por `organizationId`, RBAC e RLS;
- auditoria;
- BullMQ, payload persistido e reconciliadores para alguns fluxos;
- lead, contacto, tags, responsável, pipeline e atividades;
- filtros de API por status, origem, categoria, segmento, cidade, responsável,
  tag, score e website;
- tarefas ligadas a lead e campanha;
- campanhas, templates, resultados e métricas;
- análise de website e scoring;
- agentes assistidos de CRM e WhatsApp;
- Opportunity Finder;
- CSV e provedores de prospecção;
- créditos e `AiRun`;
- webhook configurável e API de plugin somente leitura.

### Lacunas confirmadas no commit publicado

Busca no código publicado não encontrou implementação real para:

- motor de workflows;
- views/filtros persistidos;
- campos ou atributos personalizados;
- histórico estruturado de mudança de etapa;
- dashboard/report builder;
- sincronização de mailbox ou calendário;
- sequências automáticas;
- notas colaborativas, comentários ou menções;
- call intelligence.

O texto `workflow` encontrado na UI é nome/ícone de agente, não motor de
automação. `sequence` aparece apenas em tradução de campanha.

## Comparação e prioridade

### P0 — fundação operacional

#### 1. Eventos duráveis e histórico comercial

Criar eventos idempotentes para fatos como:

- `lead.created`;
- `lead.imported`;
- `website_analysis.completed`;
- `lead.score_changed`;
- `lead.stage_changed`;
- `lead.assigned`;
- `lead.activity_created`;
- `task.overdue`;
- `campaign.result_recorded`.

Persistir evento e alteração de negócio na mesma transação. Redis apenas acorda
processamento; banco continua fonte de verdade. Reconciliador recupera dispatch
perdido.

#### 2. Listas inteligentes

Views salvas sobre campos existentes antes de campos customizados:

- filtros aninhados `AND/OR`;
- ordenações múltiplas;
- colunas e modo tabela/Kanban;
- escopo privado ou da equipa;
- filtro relativo como “sem atividade há 7 dias”;
- uso da mesma view em campanha, workflow e relatório.

#### 3. Workflows v1

Começar por editor em formulário, não canvas visual.

Gatilhos:

- evento de lead;
- mudança de score/etapa;
- análise concluída;
- entrada numa lista inteligente;
- agenda recorrente;
- execução manual.

Ações:

- tag;
- atribuição e round-robin;
- mudança de etapa;
- criação de tarefa;
- próximo contacto;
- inclusão em campanha;
- geração de rascunho por IA;
- webhook assinado.

Obrigatório: rascunho/publicado/pausado, versão imutável, preview, dry-run,
idempotência, orçamento de créditos, permissões, log por etapa, retries e
dead-letter/revisão manual.

### P1 — inteligência e medição

#### 4. Reporting histórico

Entregar relatórios fechados e configuráveis por filtros:

- funil;
- tempo por etapa;
- mudança de etapa por período;
- conversão por origem, segmento e responsável;
- velocidade de follow-up;
- leads de alto potencial sem ação;
- drill-down para registos contribuintes.

Não construir query builder SQL livre.

#### 5. Cadências assistidas

Reutilizar campanha, template, tarefa e agente:

```text
Dia 0: gerar primeira mensagem e pedir aprovação
Dia 3: criar tarefa de follow-up
Dia 7: sugerir segunda mensagem e pedir aprovação
Resposta, reunião ou doNotContact: encerrar cadência
```

Nunca enviar cold outreach automaticamente.

#### 6. Campos personalizados e inteligentes

Primeiro `Lead` e `LeadContact`; tipos controlados. Campos IA mostram fonte,
confiança, data, custo e distinção entre observação e inferência. Escrita da IA
passa por preview ou regra publicada com permissão explícita.

### P2 — relacionamento e plataforma

#### 7. E-mail/calendário

Começar por metadados de relação e eventos de calendário, não caixa de entrada
completa. Tokens criptografados, escopos mínimos, privacidade por padrão,
desconexão e eliminação verificáveis.

#### 8. Webhooks e API

Transformar integração hoje configurável em sistema real:

- assinaturas por evento;
- HMAC;
- outbox;
- chave idempotente;
- filtros;
- retries com backoff;
- histórico de entrega;
- teste seguro;
- API com escopos de leitura/escrita explícitos.

### P3 — posterior

- notas colaborativas, comentários e menções;
- importação de transcrição e extração de próximos passos;
- gravação própria de chamadas apenas após decisão sobre consentimento,
  retenção, custo e jurisdição;
- objetos totalmente personalizados;
- apps móveis e extensão de browser.

## Decisão recomendada

Primeiro grande release deve ser:

```text
Eventos duráveis + Listas inteligentes + Workflows v1 + Reporting histórico
```

Isso fecha maior lacuna do Attio usando capacidades já existentes. Campos
customizados, e-mail/calendário e call intelligence dependem dessa base.

## Gates antes de produção

1. Decidir execução de workflows: worker separado ou executor DB-backed com
   concorrência baixa. Não ampliar carga no processo HTTP sem medir.
2. Preservar DB como fonte de verdade porque Redis não tem persistência.
3. Rever limite de conexões e transações; reproduzir/regredir o `P2028`.
4. Confirmar migrations aplicadas e volumes do banco por canal SSL funcional.
5. Definir domínio próprio para API antes de ampliar OAuth e integrações.
6. Fazer migrations aditivas e compatíveis com deploy anterior.
7. Medir query plans e criar índices para views, eventos e relatórios.
8. Manter billing e provedores de pagamento fora do escopo.
9. Não executar deploy/migration remota sem autorização separada.


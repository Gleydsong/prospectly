# Prompt para Grok + Orca — implementar as integrações restantes com gates

Copie todo o bloco abaixo para o Grok no Orca.

```text
Você é o principal engineer e coordenador Orca da iniciativa de evolução do
repositório `Gleydsong/prospectly` inspirada no Attio.

OBJETIVO

Implementar, em tracer bullets verticais e independentes, as capacidades que
ainda faltam no Prospectly. Cada mudança deve ser implementada e completamente
testada em uma worktree isolada antes de qualquer commit. Commit, push/PR,
merge, migration remota e produção são gates humanos separados.

Não transforme esta iniciativa em um único PR. Entregue um ticket coeso por
branch/worktree/PR, respeitando a ordem de dependências definida abaixo.

MODO E SKILLS

1. Ative `/caveman full` para updates, perguntas, resumos e handoffs. Preserve
   escrita normal em specs, tickets, código, testes, migrations, commits e PRs.
2. Invoque `/ask-matt` antes de escolher o fluxo. Mostre a rota retornada.
3. Esta é uma iniciativa grande e multi-sessão. Rota esperada:
   `/wayfinder` -> `/to-spec` -> `/to-tickets` -> `/implement` por ticket.
4. Use `/domain-modeling` para vocabulário, `/codebase-design` para boundaries,
   `/tdd` durante a implementação e `/code-review` antes do gate de commit.
5. Use `/wizard` quando houver configuração humana de OAuth, secrets, DNS,
   Render, Google Cloud ou migration remota.
6. Se uma skill não estiver disponível, informe o nome exato. Não simule uma
   invocação que não aconteceu.

AUTORIDADE DESTA EXECUÇÃO

Está autorizado:

- inspecionar código, documentação, Git, CI e produção por meios read-only;
- criar worktree e branch isoladas sem descartar trabalho existente;
- criar/atualizar spec e tickets conforme as regras do repositório;
- implementar localmente um ticket aprovado;
- criar migrations aditivas sem executá-las em produção;
- executar testes locais, containers de teste e validações não destrutivas;
- usar mocks, fakes, emuladores ou sandbox para integrações externas;
- corrigir defeitos encontrados que sejam necessários para o ticket passar.

Não está autorizado nesta primeira execução:

- criar commit;
- fazer push;
- abrir ou atualizar PR;
- fazer merge;
- iniciar deploy;
- executar migration em staging ou produção;
- alterar secrets, env vars, DNS, OAuth apps, serviços ou planos no Render;
- enviar e-mail, mensagem, convite ou webhook para terceiros reais;
- usar dados reais de clientes em testes;
- alterar billing, Asaas, AbacatePay histórico, Stripe legado, créditos ou
  entitlement fora de uma integração mínima já existente e explicitamente
  necessária.

Ao concluir implementação, testes e revisão do primeiro ticket, pare no gate de
commit e aguarde a frase explícita `AUTORIZO COMMIT DO TICKET <id>`.

Depois do commit, pare e aguarde `AUTORIZO PUSH E PR DO TICKET <id>`.

Depois do PR aprovado e CI verde, merge exige `AUTORIZO MERGE DO PR <numero>`.

Staging/produção e migrations remotas exigem autorização posterior, específica
e separada. Nunca interprete autorização de uma etapa como autorização da
seguinte.

FONTE DA VERDADE E DESCOBERTA

Antes de editar:

- leia `AGENTS.md` e instruções aninhadas;
- leia `README.md`, `CONTEXT-MAP.md`, `docs/agents/**`, ADRs e documentação dos
  módulos tocados;
- leia integralmente:
  `docs/handoffs/2026-09-03-grok-attio-upgrade-prompt.md` e
  `docs/superpowers/reports/2026-09-03-attio-vs-prospectly-production.md`;
- inspecione `package.json`, scripts, Prisma schema/migrations, testes, módulos
  NestJS, web app, worker e configuração Render relevante;
- pesquise Issues e PRs abertos/fechados antes de criar algo;
- confirme `git worktree list --porcelain`, branch, HEAD, `origin/main` e
  `git status --short`;
- preserve todos os arquivos não rastreados e alterações do usuário;
- use uma worktree limpa baseada no `origin/main` atual, não uma checkout antiga
  ou suja.

O código, a produção e o issue tracker atuais vencem este baseline. Revalide
tudo porque ele é apenas um snapshot de 2026-09-04.

BASELINE CONHECIDO A REVALIDAR

- PR #99 estabeleceu fundação de PostgreSQL como fonte da verdade para billing
  e jobs críticos, com reconciliação de dispatch e job IDs determinísticos.
- PR #100 separou os processors BullMQ da API em um Render Background Worker.
- API e worker observados em produção estavam no commit `d10b68e8003660b6071e137d6dce652e647d673f`.
- O worker único observado era `prospectly-worker`, Starter, Frankfurt, uma
  instância, executando `node apps/api/dist/worker.js`.
- Isso é fundação operacional; não equivale a Domain Events ou transactional
  outbox da iniciativa.
- Nenhuma das sete releases de produto abaixo foi confirmada como entregue.
- Antes de novas integrações, confira se a lista de redaction do Pino ainda
  protege tanto `x-webhook-secret` quanto os headers atuais. Trate vazamento
  potencial de credencial em log como blocker P1.

CAPACIDADES RESTANTES E ORDEM DE DEPENDÊNCIA

Release 1 — eventos duráveis:

- `DomainEvent` e transactional outbox persistidos atomicamente com a mudança
  de negócio;
- publicação recuperável pelo worker, consumidor idempotente, retries,
  dead-letter/reconciliação, correlação, versionamento e retenção;
- eventos mínimos definidos no prompt original, incluindo lead, score, etapa,
  responsável, atividade, análise, campanha e tarefa vencida;
- PostgreSQL é a fonte da verdade; Redis/BullMQ é transporte reconstruível.

Release 2 — listas inteligentes:

- views salvas de Lead, filtros aninhados allowlisted, ordenação, colunas,
  tabela/Kanban, paginação estável, preview e visibilidade tenant-safe;
- um único motor de filtros reutilizável por listas, workflows e relatórios.

Release 3 — workflows v1:

- definição e versões publicadas imutáveis, triggers, conditions, steps, runs e
  step runs;
- formulário acessível antes de qualquer canvas;
- ações idempotentes, dry-run, pause, cooldown, prevenção de loops, limites por
  organização, retries e revisão manual;
- pode gerar rascunho, mas nenhuma ação envia mensagem automaticamente.

Release 4 — reporting histórico:

- histórico de etapa e relatórios de funil, tempo em etapa, conversão, velocidade
  de follow-up e oportunidades sem ação;
- queries tenant-safe, indexadas, paginadas, limitadas e testadas com volume.

Release 5 — cadências assistidas:

- rascunhos e tarefas programadas, com aprovação humana;
- resposta, reunião, opt-out, suppression ou `doNotContact` encerram a cadência;
- proibição técnica e testada de cold outreach automático.

Release 6 — campos personalizados e IA:

- campos de Lead/LeadContact com tipos fechados, estratégia de armazenamento e
  índices aprovada;
- integração com views, import/export, workflows e reports;
- campos IA auditáveis com fonte, timestamp, confiança, custo, prompt/modelo,
  distinção entre fato e inferência e confirmação humana para mutações.

Release 7 — Gmail, Google Calendar e webhooks/API:

- OAuth com PKCE/state, scopes mínimos, tokens criptografados, rotação,
  revogação, sync cursor, renovação e exclusão verificável;
- sincronizar metadados necessários antes de conteúdo; privacidade por padrão;
- ligação determinística e tenant-safe de e-mails/reuniões;
- subscriptions por evento, HMAC SHA-256, timestamp/replay protection,
  idempotency key, outbox, filtros allowlisted, retries, dead-letter, histórico
  sanitizado e teste seguro;
- Microsoft e MCP permanecem fora do primeiro ciclo.

Não inicie uma release dependente enquanto os contratos que ela consome ainda
não estiverem entregues. A sequência padrão é R1 -> R2 -> R3 -> R4 -> R5 -> R6
-> R7. O `/wayfinder` pode propor pequenos tracer bullets preparatórios, mas deve
explicar qualquer alteração dessa ordem.

REGRAS INEGOCIÁVEIS

- Preserve multi-tenancy derivada da sessão, RLS, RBAC e auditoria.
- `organizationId`, role e permissões nunca vêm confiados do cliente.
- `doNotContact`, suppression, consentimento e LGPD têm precedência.
- Nenhum workflow ou cadência envia cold email, WhatsApp ou LinkedIn.
- IA pesquisa, classifica, resume e gera rascunhos; ações comerciais exigem
  confirmação humana explícita.
- Não registre tokens, authorization headers, cookies, payloads sensíveis,
  conteúdo completo de e-mail ou prompts com PII.
- Preserve PostgreSQL como fonte da verdade. Jobs devem sobreviver à perda do
  Redis e ser redespacháveis sem duplicar efeitos.
- Migrations são aditivas, backward-compatible e com rollback lógico.
- Todo novo modelo tenant-owned recebe políticas RLS e testes em PostgreSQL real.
- Não crie objetos genéricos ilimitados, SQL/JSONPath arbitrário, microserviços
  especulativos ou dependências sem necessidade comprovada.
- Não faça refactors oportunistas nem altere áreas fora do ticket.

ORQUESTRAÇÃO ORCA

Atue como coordenador. Crie um DAG antes de delegar e use poucos agentes com
ownership vertical e explícito. Para cada agente informe objetivo, contexto,
arquivos/módulos possivelmente envolvidos, dependências, restrições, critérios
de aceitação, validações exigidas e mudanças proibidas.

Papéis recomendados:

1. Explorer read-only: mapeia implementação real, padrões, dependências e testes.
2. Spec/domain reviewer read-only: confronta o ticket com domínio, ADRs e prompt.
3. Implementer: possui um tracer bullet vertical na worktree isolada.
4. Verifier/reviewer independente: revisa Standards e Spec e executa validação.
5. Security/privacy reviewer read-only nas releases com eventos, IA, OAuth,
   webhooks, PII ou autorização.

Regras de coordenação:

- não permita edição concorrente dos mesmos arquivos;
- serialize tarefas que compartilhem schema, migrations ou contratos;
- worker que diz `done` deve informar arquivos alterados, testes executados,
  resultados, riscos, pressupostos e pendências;
- o coordenador reinspeciona diff, testes e Git status; relato do worker não é
  evidência suficiente;
- falha de teste volta ao implementer e reinicia o gate completo;
- nenhum subagente possui autoridade para commit, push, PR, merge ou deploy.

FLUXO POR TRACER BULLET

Fase 0 — decisão e especificação:

1. Revalide o estado real e atualize matriz `já existe | parcial | falta`.
2. Resolva somente decisões que bloqueiam o próximo tracer bullet.
3. Produza/atualize spec precisa e tickets verticais com dependências e critérios.
4. Se houver decisão irreversível sem resposta, faça a pergunta humana mínima e
   pare antes de editar.

Critério de conclusão: primeiro ticket agent-ready, sem dependência desconhecida
e com contrato, ameaça, observabilidade, rollout e testes definidos.

Fase 1 — worktree e RED:

1. Crie worktree limpa e branch `codex/<ticket>-<slug>` a partir de
   `origin/main` atualizado.
2. Registre baseline de testes do seam afetado.
3. Escreva teste comportamental que falha pelo motivo esperado.

Critério de conclusão: RED reproduz exatamente o comportamento ausente sem
falha ambiental mascarando o resultado.

Fase 2 — GREEN e integração local:

1. Implemente a menor fatia ponta a ponta que satisfaz o ticket.
2. Execute testes focados a cada slice.
3. Integre API, worker, banco e UI apenas quando fizerem parte do comportamento.
4. Use fakes/sandbox para Google e webhooks; nunca dependa de credenciais reais
   para a suíte reproduzível.
5. Documente env vars por nome e finalidade, sem valores.

Critério de conclusão: comportamento passa pelo seam público, efeitos são
idempotentes, isolamento tenant e falhas/retries estão demonstrados.

Fase 3 — validação obrigatória antes de commit:

Descubra os comandos reais no workspace. Execute, quando aplicável:

- geração e validação Prisma;
- testes focados unit/integration/HTTP;
- testes RLS com PostgreSQL real;
- testes de idempotência, retry, recovery e concorrência;
- testes do worker com processo HTTP separado;
- Playwright desktop e mobile para UI nova;
- lint;
- typecheck;
- suíte completa relevante;
- build de `shared-types`, API, web e landing afetados;
- auditoria de dependências no nível estabelecido pelo repositório;
- `git diff --check`;
- inspeção de `git diff --stat`, diff completo e `git status --short`.

Testes mínimos específicos:

- R1: atomicidade do outbox, redelivery, replay, crash entre persistência e
  publicação, ordem quando necessária e ausência de efeito duplicado.
- R2: AST inválida, campos não permitidos, paginação estável e cross-tenant.
- R3: dry-run, pause, loop prevention, cooldown, retry, créditos e zero envio.
- R4: query plans/índices, limites, volume representativo e cross-tenant.
- R5: todos os stop conditions e bloqueio técnico de auto-send.
- R6: tipos, import/export, índices, auditoria de IA, PII e confirmação humana.
- R7: OAuth state/PKCE, criptografia, refresh/revogação, webhook HMAC/replay,
  cursor/recovery, unlink/delete e logs sanitizados.

Registre comando, exit code e resumo do resultado. Um comando não executado deve
aparecer como `NÃO EXECUTADO` com motivo. Não diga que passou por inferência.

Critério de conclusão: todas as validações aplicáveis verdes, nenhuma falha
oculta e nenhum arquivo inesperado no diff.

Fase 4 — revisão independente antes de commit:

Execute `/code-review` em dois eixos independentes:

- Standards: correção, segurança, arquitetura, regressões, testes, escopo e
  simplicidade.
- Spec: cada critério de aceitação e regra inegociável demonstrado por código e
  teste.

Resolva P0/P1/P2. Reexecute os testes afetados e o gate completo proporcional.
P3 deve ser resolvido ou registrado com justificativa. Reviewer não aprova o
próprio trabalho sem revisão independente.

Critério de conclusão: zero achado bloqueante e matriz de aceitação com evidência.

GATE 1 — PARE ANTES DO COMMIT

Entregue ao usuário:

Estado:
Ticket/release:
Worktree/branch/HEAD base:
Arquivos alterados:
Migration criada e não aplicada remotamente:
Testes e exit codes:
Revisão Standards:
Revisão Spec:
Segurança/privacidade:
Riscos e rollback:
Diff não commitado:
Commit/push/PR/merge/deploy: NÃO EXECUTADOS
Próxima autorização: `AUTORIZO COMMIT DO TICKET <id>`

Após autorização do commit, crie um commit focado, mostre hash e status e pare.
Não use essa autorização para push ou PR.

GATE 2 — PARE ANTES DE PUSH/PR

Depois do commit, confirme que HEAD contém somente o ticket e que a worktree está
limpa. Se o commit mudou artefatos gerados, reexecute as verificações necessárias.
Peça: `AUTORIZO PUSH E PR DO TICKET <id>`.

Após autorização, faça push e abra um PR com resumo, decisões, migrations,
ameaças, testes reais e plano de rollback. Não faça merge.

GATE 3 — CI E MERGE

Observe o CI. Se falhar, diagnostique, corrija localmente, reexecute validações e
volte ao gate de commit para o novo commit. CI verde não autoriza merge.
Peça: `AUTORIZO MERGE DO PR <numero>`.

GATE 4 — PRODUÇÃO

Merge não autoriza deploy ou migration. Antes de solicitar produção, prepare um
runbook com:

- commit exato e artefato;
- ordem backward-compatible de migration e deploy;
- teste da migration em cópia representativa;
- backup/rollback lógico sem apagar dados;
- feature flag por organização e canário interno;
- capacidade e conexões de API, worker, PostgreSQL e Redis;
- métricas/alertas de erros, latência, filas, retries, DLQ e banco;
- smoke tests e critérios objetivos de abortar;
- configurações humanas de OAuth/DNS/secrets via `/wizard`;
- confirmação de que nenhum custo adicional foi criado sem autorização.

Somente execute produção após autorização explícita que nomeie serviço, commit,
migration e ambiente. Registre evidência separada de migration, deploy, health,
smoke test e observabilidade. Preserve rollback.

PRIMEIRA RESPOSTA ESPERADA

Não edite código ainda. Responda em `/caveman full` com:

1. skills encontradas e rota do `/ask-matt`;
2. checkout/worktrees/branches/status e comparação com `origin/main`;
3. matriz atualizada das sete releases: entregue, parcial ou ausente;
4. confirmação do P1 de redaction ou evidência de que já foi corrigido;
5. DAG da iniciativa e dependências;
6. primeiro tracer bullet recomendado da Release 1;
7. agentes Orca a despachar, ownership e critérios;
8. perguntas humanas somente se bloquearem decisão irreversível.

Depois dessa descoberta, prossiga com spec/tickets e implementação do primeiro
tracer bullet autorizado. Pare obrigatoriamente no Gate 1 antes do commit.
```

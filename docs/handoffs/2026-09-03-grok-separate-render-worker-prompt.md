# Prompt para Grok — separar BullMQ da API no Render

Cole o bloco abaixo no Grok a partir do repositório Prospectly.

```text
Ative `/caveman` durante toda a execução: respostas curtas, sem repetir contexto, preservando comandos, evidências, erros e decisões.

Primeiro invoque explicitamente `/ask-matt`. Use o roteamento que ele indicar para uma mudança relevante em codebase existente. Rota esperada: `/grill-with-docs` para validar o estado real e os riscos, depois `/implement` (TDD interno) e `/code-review`. Não reinicie entrevista sobre decisões já fechadas abaixo. Só pergunte se surgir escolha material sem resposta no código, na produção ou neste prompt.

OBJETIVO

Separar todos os processors BullMQ do processo HTTP `prospectly-api` para exatamente um Render Background Worker chamado `prospectly-worker`, plano Starter / `0.5c-512mb`, região Frankfurt, custo de tabela máximo de US$7/mês (aproximadamente €7 antes de câmbio/impostos).

Depois do rollout:

- API: HTTP, produtores BullMQ e reconciliadores de dispatch; zero processors/consumidores BullMQ.
- Worker: processors BullMQ; zero listener HTTP; zero migrations; zero schedulers, polling loops ou reconciliadores pertencentes à API.
- PostgreSQL continua fonte da verdade.
- Redis/BullMQ continua transporte recuperável.

AUTORIZAÇÃO FINANCEIRA E OPERACIONAL

Autorizado:

- criar exatamente 1 serviço Render Background Worker;
- plano Starter / `0.5c-512mb`;
- preço de tabela de até US$7/mês;
- editar código, testes e documentação necessários;
- fazer deploy sequencial e verificações não destrutivas;
- usar os mesmos Postgres e Key Value já existentes.

Não autorizado:

- upgrade de PostgreSQL, Redis/Key Value, API, landing ou workspace;
- plano Pro, autoscaling ou segunda réplica;
- criar cron, private service ou outro recurso pago;
- alterar billing/Asaas/AbacatePay, schema financeiro ou entitlement;
- alterar dados de clientes para testar;
- imprimir, copiar para arquivos ou incluir em logs valores de secrets;
- sincronizar todo o Blueprint se isso puder modificar recursos além do worker;
- merge/force-push destrutivo ou descarte de alterações do usuário.

Se o Dashboard/API mostrar custo acima do limite, taxa de workspace, upgrade colateral ou recurso adicional: pare antes da mutação e reporte o valor exato.

ESTADO CONHECIDO — CONFIRME, NÃO PRESUMA

O repositório já contém grande parte da separação:

- `apps/api/src/worker.ts`: application context Nest sem HTTP.
- `apps/api/src/worker.module.ts`: entry module do worker.
- `apps/api/src/modules/workers/workers.module.ts`: processors.
- `apps/api/src/common/workers/graceful-shutdown.ts`.
- `apps/api/package.json`: `start:worker`, `start:worker:prod`, `dev:worker`.
- `apps/api/Dockerfile`: targets `worker` e `api`; ambos contêm `dist/worker.js`.
- `docs/deploy/workers.md`: desenho anterior.
- `AppModule` ainda importa `WorkersModule` como fallback inline.
- `app.module.spec.ts` ainda exige esse fallback e deve ser invertido.

Processors observados:

- prospecting;
- imports;
- scoring;
- website-analysis;
- opportunity-finder;
- privacy retention, hoje registrado diretamente em `PrivacyModule`.

Riscos observados:

1. `ProspectingModule` registra `ProspectingDispatchReconciler`.
2. `ImportsModule` registra `ImportsDispatchReconciler`.
3. `PrivacyModule` registra simultaneamente `RetentionProcessor` e `RetentionScheduler`.
4. Módulos transitivos podem possuir `OnModuleInit`, `OnApplicationBootstrap`, timers ou polling, incluindo billing.
5. Importar esses módulos no `WorkerModule` pode iniciar tarefas que pertencem apenas à API.
6. `validateEnv` atualmente exige secrets globais de API mesmo no papel worker.
7. `DATABASE_APP_URL` é obrigatório em produção e o Prisma prefere essa conexão RLS; jobs usam `runWithTenant`/`runWithBypass`.
8. O `render.yaml` visto anteriormente declarava alguns planos pagos enquanto a produção observada tinha recursos free. Um sync amplo pode aumentar a fatura além deste worker.

FASE 0 — BASE E ESCOPO

1. Execute:
   - `pwd`
   - `git worktree list --porcelain`
   - `git status --short`
   - `git branch --show-current`
   - `git fetch origin --prune`
2. Leia `AGENTS.md`, nested instructions, `CONTEXT-MAP.md`, docs de domínio, deploy, workers e migrations aplicáveis.
3. Não trabalhe sobre checkout sujo. Preserve todos os arquivos do usuário. Use worktree isolada baseada no commit realmente implantado em produção e branch `codex/separate-render-worker`.
4. Consulte Render de forma read-only e confirme:
   - serviço/API e commit implantado;
   - região e plano;
   - Postgres/Redis usados;
   - ausência/presença de worker;
   - planos reais ao vivo;
   - diferença entre produção e `render.yaml`;
   - preço exibido para um único worker Starter.
5. Produza uma tabela curta `repo esperado × Render real × ação` antes de mutar produção.

FASE 1 — DESENHO MÍNIMO

Inspecione o grafo Nest real. Liste todos os providers alcançáveis a partir de `WorkerModule` que tenham:

- `@Processor`;
- `OnModuleInit`;
- `OnApplicationBootstrap`;
- `setInterval`/`setTimeout` recorrente;
- consumo de fila;
- reconciliação/polling;
- servidor/listener;
- migrations/seeds.

Classifique cada um:

- API-only: produtores, controllers, dispatch reconcilers, webhook reconciliation, schedulers.
- worker-only: processors BullMQ.
- shared: serviços de domínio, Prisma, clientes de provider, filas, auditoria, métricas/logging.

Use módulos profundos e interfaces pequenas. Faça a menor mudança que garanta a separação. Não crie framework genérico de jobs.

Regras obrigatórias:

- Não basta remover `WorkersModule` do `AppModule`.
- `RetentionProcessor` também deve sair do grafo da API.
- `RetentionScheduler` deve permanecer fora do grafo efetivo do worker.
- reconciliadores de prospecting/imports devem executar apenas no papel API.
- timers de billing/webhook não podem duplicar no worker.
- nenhum processor pode ser instanciado pela API.
- nenhum controller precisa ser exposto pelo worker.
- o worker não chama `listen()`.
- somente o caminho oficial de release executa migrations, uma vez.

Prefira separar módulos de composição API/worker. Se uma separação estrutural pequena não for possível, use uma checagem de papel explícita, centralizada e testada (`ROLE=api|worker`), sem condicionais espalhadas. Documente o compromisso e abra follow-up somente se necessário.

Não reduza RLS. O worker deve usar a identidade de banco apropriada e `runWithTenant` para operações tenant-scoped. `runWithBypass` só nos pontos já justificados para descobrir o tenant/registro, nunca como atalho geral.

Revise validação de ambiente por papel:

- API exige seus secrets HTTP/auth/billing existentes.
- Worker exige apenas variáveis realmente usadas pelo grafo worker.
- Ambos exigem conexão necessária com Postgres/Redis.
- Não replique JWT/billing secrets no worker apenas para satisfazer validação global defeituosa; torne a validação role-aware se seguro e pequeno.
- Nunca exponha valores durante a auditoria.

FASE 2 — IMPLEMENTAÇÃO TDD

Primeiro escreva testes que falhem. Cobertura mínima:

1. `AppModule` não importa nem instancia `WorkersModule`/processors.
2. `WorkerModule` registra todos e somente os processors esperados.
3. `RetentionProcessor` não existe no contexto API.
4. Reconciliadores/schedulers/timers API-only não iniciam no contexto worker.
5. Worker inicia como application context sem listener HTTP.
6. `SIGTERM`/`SIGINT` fecha consumo graciosamente e respeita `WORKER_SHUTDOWN_TIMEOUT_MS`.
7. API continua registrando filas como produtora e health/readiness continua válido.
8. Validação de env distingue `ROLE=api` e `ROLE=worker` sem enfraquecer produção.
9. Jobs continuam carregando contexto autoritativo do PostgreSQL e mantendo idempotência/retries existentes.

Implemente RED → GREEN em slices pequenos. Preserve nomes de filas, payloads, attempts, backoff, `jobId`, correlação, estados persistidos e reconciliadores existentes.

Não implementar nesta tarefa:

- outbox genérico novo;
- mudança de schema/migration, salvo prova de necessidade indispensável;
- Redis persistente;
- PgBouncer;
- autoscaling;
- múltiplos workers por tipo de fila;
- refatoração ampla de módulos;
- novas features de CRM/workflow.

FASE 3 — RENDER SEM COBRANÇA COLATERAL

Configuração pretendida:

- tipo: Render Background Worker (`worker`, conforme schema oficial atual);
- nome: `prospectly-worker`;
- runtime: Docker;
- região: `frankfurt`;
- plano: `starter` / `0.5c-512mb`;
- branch: `main`;
- Dockerfile: `apps/api/Dockerfile`;
- contexto: raiz do repo;
- comando: `node dist/worker.js` OU target Docker `worker`, escolha uma estratégia confirmada pelo schema atual;
- `ROLE=worker`;
- `NODE_ENV=production`;
- `WORKER_SHUTDOWN_TIMEOUT_MS=30000`;
- `autoDeployTrigger=checksPass` somente após rollout seguro.

Variáveis:

- use URLs privadas do Postgres e Redis na mesma região;
- `DATABASE_APP_URL` deve preservar RLS;
- `DATABASE_URL` owner só se o código realmente precisar dos acessos bypass já aprovados;
- inclua somente chaves de provedores usadas pelos jobs habilitados;
- secrets devem vir de referências/ambiente seguro, nunca texto literal no Git;
- não copie secrets API-only sem necessidade demonstrada.

Antes de usar Blueprint, valide o schema oficial atual. Compare o preview com a produção. O único custo novo permitido é o worker.

IMPORTANTE: se `render.yaml` tiver drift que converteria Redis, landing, DB ou qualquer serviço free para pago, NÃO sincronize o Blueprint inteiro. Nesse caso:

1. atualize a declaração/documentação do worker no Git apenas se isso não induzir aplicação insegura;
2. provisione somente o worker via operação Render direcionada;
3. registre o drift como risco/follow-up;
4. não altere os demais serviços.

FASE 4 — ROLLOUT SEM PERDA

Faça rollout sequencial:

1. Garanta que o commit worker-capable está construído e que timers API-only não executam no worker.
2. Mantenha temporariamente o consumidor inline apenas durante a introdução do novo serviço, se necessário para evitar uma janela sem consumidor.
3. Crie o único worker Starter e aguarde estado live.
4. Confirme log sanitizado `BullMQ worker context started (no HTTP listener)`.
5. Confirme conexão privada com Postgres/Redis sem imprimir URLs.
6. Confirme que o worker consegue consumir job seguro existente/controlado. Não crie nem modifique dados reais de cliente só para teste.
7. Remova/desative definitivamente os processors inline da API.
8. Faça deploy da API e confirme `/health/ready` HTTP 200.
9. Confirme por logs/telemetria que:
   - worker processa jobs;
   - API não processa jobs;
   - filas drenam;
   - retries/falhas continuam registrados;
   - não há scheduler/reconciliador duplicado;
   - não apareceu pico anormal de conexões Postgres.

É aceitável uma janela curta com dois consumidores BullMQ durante o handover; não é aceitável executar schedulers/reconciliadores duplicados ou perder registros persistidos. Se deploy automático impedir ordem segura, pause o rollout e use estratégia controlada. Não improvise mutação ampla.

ROLLBACK

Prepare antes do deploy:

- reativar fallback inline da API por revert/configuração testada;
- redesplegar API;
- somente depois suspender o worker para parar cobrança;
- jobs pendentes permanecem no Redis e registros autoritativos permanecem no PostgreSQL;
- não apagar fila nem registros para “limpar”.

Se o worker não iniciar, mantenha API consumindo inline até corrigir. Nunca remova o último consumidor funcional antes de provar o novo.

VALIDAÇÃO LOCAL OBRIGATÓRIA

Use comandos do repositório e reporte exit code:

- testes novos e testes de processors/reconciliadores;
- suite API relevante;
- typecheck;
- lint;
- build de shared-types e API;
- build Docker target API;
- build Docker target worker;
- smoke do `dist/worker.js` com dependências locais/mocks seguros;
- `git diff --check`;
- `git status --short`;
- inspeção final do diff.

Não chame “concluído” se qualquer gate obrigatório falhar. Não esconda testes não executados.

CRITÉRIOS DE ACEITE

- exatamente 1 novo worker Starter, nenhum outro aumento de custo;
- custo exibido e reportado;
- API e worker no mesmo region/private network;
- API não instancia nenhum `@Processor`;
- worker não abre HTTP;
- worker não roda migrations, seeds, webhook polling, reconciliadores ou schedulers API-only;
- todos os seis grupos de processamento continuam cobertos, incluindo retention;
- graceful shutdown comprovado;
- tenant/RLS, auditoria, idempotência, retries e correlação preservados;
- API saudável mesmo se worker reiniciar;
- dados persistidos continuam recuperáveis se Redis/worker falhar;
- nenhuma mudança em billing, DB/Redis plans ou dados de cliente;
- documentação e runbook/rollback atualizados;
- review final `/code-review` sem P0/P1 aberto.

ENTREGA FINAL — FORMATO CURTO

Reporte:

1. resultado: concluído, parcial ou bloqueado;
2. branch/commit/PR e commit de produção;
3. arquivos alterados;
4. processors movidos;
5. como schedulers/reconciliadores foram isolados;
6. testes/comandos com resultado;
7. serviço Render criado, plano, região e custo;
8. evidência de API healthy e worker consumindo;
9. custo antes/depois e confirmação de zero upgrades colaterais;
10. riscos restantes e rollback exato.

Não diga que produção está pronta apenas porque CI/build passou. Diferencie código, merge, deploy, worker live e consumo real.
```

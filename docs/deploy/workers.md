# Workers Prospectly (BullMQ)

API HTTP e worker BullMQ são processos distintos. PostgreSQL é a fonte da verdade; Redis/BullMQ é só transporte recuperável. ADR: [`docs/adr/0006-separate-bullmq-worker.md`](../adr/0006-separate-bullmq-worker.md).

## Papéis

| Processo | Entrypoint | Responsabilidade |
|---------|------------|----------------|
| API | `apps/api/src/main.ts` → `node apps/api/dist/main.js` (produção Node) | HTTP, produtores de fila, reconciliadores de dispatch, `RetentionScheduler`, polling de webhook Asaas. **Zero** `@Processor`. |
| Worker | `apps/api/src/worker.ts` → `node apps/api/dist/worker.js` | Application context Nest **sem** `listen`. Processors BullMQ. **Zero** HTTP, migrations, schedulers, reconciliadores ou webhook polling. |

`main.ts` força `ROLE=api`. `worker.ts` força `ROLE=worker`. `validateEnv` é role-aware: worker exige `DATABASE_URL`, `REDIS_URL` e `DATABASE_APP_URL` em produção; não exige JWT/billing.

Filas: prospecting, imports, scoring, website-analysis, opportunity-finder, privacy-retention, outbox.

Composição:

- `WorkersModule` — os sete processors (incluindo `RetentionProcessor` e `OutboxProcessor`).
- `ApiDispatchModule` — reconciliadores de prospecting, imports, website-analysis, opportunity-finder e outbox. Só no `AppModule`.
- `PrivacyModule` — scheduler + HTTP de privacidade. Só na API.
- `PrivacyRetentionModule` — `RetentionService` + fila. API e worker.
- `BillingCoreModule` — serviços de crédito/entitlement. `BillingModule` (API) adiciona controller + `AsaasWebhookService`.

## Desenvolvimento local

```bash
pnpm --filter @prospectly/api run dev          # API + worker
pnpm --filter @prospectly/api run dev:api
pnpm --filter @prospectly/api run dev:worker
pnpm --filter @prospectly/api run build
pnpm --filter @prospectly/api run start        # API
pnpm --filter @prospectly/api run start:worker
```

## Docker (imagem, não o runtime live da API)

A API **live** na Render é runtime **Node**, não Docker. O Dockerfile ainda tem targets `api` / `worker` para builds locais e um eventual corte Docker.

```bash
docker build -f apps/api/Dockerfile -t prospectly-api --target api .
docker build -f apps/api/Dockerfile -t prospectly-worker --target worker .
```

Não rode `prisma migrate deploy` no worker.

## Encerramento gracioso

`SIGTERM` / `SIGINT`:

1. Para intake BullMQ via `app.close()`.
2. Espera jobs em voo até `WORKER_SHUTDOWN_TIMEOUT_MS` (default `30000`).
3. Fecha Redis/Prisma.
4. Loga `Worker shutdown complete` (ou force exit).

## Migrations

Uma vez por release, fora do worker. Ver [`migrations.md`](./migrations.md).

## Render — não sincronize o Blueprint

Produção observada (2026-09-03), **não** igual ao `render.yaml`:

| Recurso | Live | `render.yaml` | Ação |
| --- | --- | --- | --- |
| `prospectly-api` | Node, `0.5c-512mb`, frankfurt, commit `03e4f60` | Docker starter | não sync |
| `prospectly-web` | static starter | static | não sync |
| landing `prospectly` | **free** | landing starter | não sync |
| `prospectly-db` | `0.1c-256mb`, disk 1GB | `basic-256mb`, disk 5GB | não sync |
| `prospectly-redis` | **free**, noeviction | starter | não sync |
| `prospectly-worker` | ausente | não declarado | criar **só** este serviço |

Custo de tabela do worker Starter / `0.5c-512mb`: **US$7/mês**. Workspace Hobby sem taxa extra. Qualquer preview de Blueprint que mude Redis/DB/landing/API: **parar**.

### Serviço worker (operação dirigida)

- tipo API: `background_worker` (Blueprint: `type: worker`)
- nome: `prospectly-worker`
- runtime: **node** (igual à API live)
- região: `frankfurt`
- plano: `starter` / `0.5c-512mb`
- branch: `main` depois do rollout; no corte pode apontar para a branch do worker
- build: o mesmo da API (`pnpm install --frozen-lockfile --filter @prospectly/api... --config.production=false && pnpm --filter @prospectly/shared-types run build && pnpm --filter @prospectly/api exec prisma generate && pnpm --filter @prospectly/api run build`)
- start: `node apps/api/dist/worker.js`
- `autoDeploy`: `no` até o worker estar live; depois `checksPass` se a API já estiver sem processors
- env: `ROLE=worker`, `NODE_ENV=production`, `WORKER_SHUTDOWN_TIMEOUT_MS=30000`
- copiar da API (valores via Dashboard/API, nunca no Git): `DATABASE_URL`, `DATABASE_APP_URL`, `REDIS_URL` (privados da mesma região), `OSM_USER_AGENT`, `GOOGLE_PLACES_API_KEY`, `OPPORTUNITY_AI_*` / `WHATSAPP_AI_*` se os jobs de opportunity usarem, `LOG_LEVEL`, `SENTRY_DSN`
- **não** copiar JWT, Asaas, AbacatePay, SMTP, `GOOGLE_CLIENT_ID`, `OPS_METRICS_TOKEN`, CORS

## Rollout sem perda

1. Worker-capable no Git: `WorkerModule` sem reconcilers/schedulers/webhook.
2. Manter API antiga consumindo até o worker live (janela curta com dois consumidores BullMQ é aceitável).
3. Criar **um** worker Starter; esperar live.
4. Log: `BullMQ worker context started (no HTTP listener)`.
5. Confirmar consumo de job controlado. Não alterar dados de cliente.
6. Deploy da API **sem** `WorkersModule`. `GET /health/ready` → 200.
7. Confirmar: worker processa; API não processa; filas drenam; sem scheduler/reconciler duplicado; sem pico anómalo de conexões Postgres.

Se `autoDeployTrigger=checksPass` na API impedir a ordem: pause auto-deploy da API, suba o worker, só então redesploy da API.

## Rollback

1. Reverter a API para a revisão que ainda importava `WorkersModule` (fallback inline).
2. Confirmar `/health/ready` e consumo na API.
3. **Depois** suspender `prospectly-worker` para parar a cobrança.
4. Não apagar filas Redis nem registros Postgres.

## Critérios de aceite

- 1 worker Starter, zero upgrades colaterais.
- API e worker na mesma região / rede privada.
- API sem `@Processor`; worker sem HTTP, migrate, scheduler ou reconciler API-only.
- Os seis grupos de processamento cobertos, incluindo retention.
- Graceful shutdown, RLS (`DATABASE_APP_URL` + `runWithTenant`), auditoria, idempotência e retries preservados.

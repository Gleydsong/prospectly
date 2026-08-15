# Prospectly workers (BullMQ)

After the Phase 1 metric gate (queue depth, HTTP latency, CPU/memory, Postgres connections, per-job concurrency), split BullMQ processing out of the HTTP API.

## Roles

| Process | Entrypoint | Responsibility |
|---------|------------|----------------|
| API | `apps/api/src/main.ts` → `dist/main.js` | HTTP + queue **producers** (and dispatch reconcilers). Does **not** register BullMQ processors. |
| Worker | `apps/api/src/worker.ts` → `dist/worker.js` | Nest application context **without** HTTP listen. Loads `WorkersModule` processors only. |

Queues (shared Redis): prospecting, imports, scoring, website-analysis.

## Local development

```bash
# API HTTP + worker BullMQ (mesmo comando)
pnpm --filter @prospectly/api run dev

# Opcional: processos isolados
pnpm --filter @prospectly/api run dev:api
pnpm --filter @prospectly/api run dev:worker
```

Production-like:

```bash
pnpm --filter @prospectly/api run build
pnpm --filter @prospectly/api run start          # API
pnpm --filter @prospectly/api run start:worker  # Worker
```

## Docker

Same image, different target/CMD:

```bash
# API (default final stage — matches current Render blueprint)
docker build -f apps/api/Dockerfile -t prospectly-api --target api .

# Worker (no migrate, no HTTP)
docker build -f apps/api/Dockerfile -t prospectly-worker --target worker .
```

Alternative without a second image build: reuse the API image and override the command to `node dist/worker.js` (do **not** run `prisma migrate deploy` on the worker).

## Graceful shutdown

On `SIGTERM` / `SIGINT` the worker:

1. Stops accepting new jobs (BullMQ worker `close` via Nest shutdown hooks).
2. Waits for in-flight jobs up to `WORKER_SHUTDOWN_TIMEOUT_MS` (default `30000`).
3. Closes Redis connections and Prisma (`OnModuleDestroy`).
4. Logs `Worker shutdown complete` (or forces exit on timeout/failure).

## Migrations

Run **once** per release on the API (or a dedicated migrate job). Workers must **not** run `prisma migrate deploy`.

## Render (proposal — needs approval)

**Do not apply this to `render.yaml` until approved.** Keep API and worker in the **same region** (`frankfurt`) on the **private network** so both use private `DATABASE_URL` / `REDIS_URL`.

Suggested Blueprint fragment (worker as Render **background worker**, same Dockerfile, `--target worker`):

```yaml
# PROPOSED — append under projects[0].environments[0].services
# Approval required before merging into render.yaml.

          - type: worker
            name: prospectly-worker
            runtime: docker
            region: frankfurt
            plan: starter
            branch: main
            dockerfilePath: ./apps/api/Dockerfile
            dockerContext: .
            dockerCommand: node dist/worker.js
            # If using BuildKit target instead of CMD override:
            # dockerBuildTarget: worker
            autoDeployTrigger: checksPass
            buildFilter:
              paths:
                - apps/api/**
                - packages/**
                - pnpm-lock.yaml
                - pnpm-workspace.yaml
                - package.json
            envVars:
              - key: NODE_ENV
                value: production
              - key: ROLE
                value: worker
              - key: WORKER_SHUTDOWN_TIMEOUT_MS
                value: "30000"
              - key: DATABASE_URL
                fromDatabase:
                  name: prospectly-db
                  property: connectionString
              - key: REDIS_URL
                fromService:
                  type: keyvalue
                  name: prospectly-redis
                  property: connectionString
              - key: JWT_ACCESS_SECRET
                fromService:
                  type: web
                  name: prospectly-api
                  envVarKey: JWT_ACCESS_SECRET
              - key: JWT_REFRESH_SECRET
                fromService:
                  type: web
                  name: prospectly-api
                  envVarKey: JWT_REFRESH_SECRET
              - key: OSM_USER_AGENT
                value: Prospectly/1.0 (https://prospectly.dev)
              - key: GOOGLE_PLACES_API_KEY
                sync: false
              - key: LOG_LEVEL
                value: info
              - key: SENTRY_DSN
                sync: false
```

Also update the API service description/docs so it is **HTTP + producers only** (no in-process processors). Scale workers independently of HTTP replicas.

> Note: confirm the exact Render Blueprint keys (`type: worker` vs `type: background_worker`, and `dockerBuildTarget` support) against the current [render.yaml schema](https://render.com/schema/render.yaml.json) before applying.

## Acceptance criteria

- Scaling workers does not add HTTP replicas.
- Shutdown does not lose in-flight jobs (within timeout; jobs retry via BullMQ attempts).
- Worker failure does not take the API down (separate process/service).
- API remains available if the worker is stopped (jobs queue in Redis).

## Rollout

1. Deploy worker service first (or together with API that no longer hosts processors).
2. Confirm queue depth drains and `WorkerBootstrap` logs appear.
3. Only then remove any temporary inline-worker fallback (none shipped in this change).

# Workers Prospectly (BullMQ)

Depois do gate de métricas da Fase 1 (profundidade de fila, latência HTTP, CPU/memória, conexões Postgres, concorrência por job), separe o processamento BullMQ da API HTTP.

## Papéis

| Processo | Entrypoint | Responsabilidade |
|---------|------------|----------------|
| API | `apps/api/src/main.ts` → `dist/main.js` | HTTP + **produtores** de fila (e reconciliadores de dispatch). **Não** registra processors BullMQ. |
| Worker | `apps/api/src/worker.ts` → `dist/worker.js` | Contexto Nest **sem** `listen` HTTP. Carrega só os processors do `WorkersModule`. |

Filas (Redis compartilhado): prospecting, imports, scoring, website-analysis.

## Desenvolvimento local

```bash
# API HTTP + worker BullMQ (mesmo comando)
pnpm --filter @prospectly/api run dev

# Opcional: processos isolados
pnpm --filter @prospectly/api run dev:api
pnpm --filter @prospectly/api run dev:worker
```

Parecido com produção:

```bash
pnpm --filter @prospectly/api run build
pnpm --filter @prospectly/api run start          # API
pnpm --filter @prospectly/api run start:worker  # Worker
```

## Docker

Mesma imagem, target/CMD diferentes:

```bash
# API (estágio final default — bate com o Blueprint atual da Render)
docker build -f apps/api/Dockerfile -t prospectly-api --target api .

# Worker (sem migrate, sem HTTP)
docker build -f apps/api/Dockerfile -t prospectly-worker --target worker .
```

Alternativa sem segundo build: reutilize a imagem da API e sobrescreva o comando para `node dist/worker.js` (**não** rode `prisma migrate deploy` no worker).

## Encerramento gracioso

Em `SIGTERM` / `SIGINT` o worker:

1. Para de aceitar jobs novos (`close` do worker BullMQ via hooks de shutdown do Nest).
2. Espera jobs em voo até `WORKER_SHUTDOWN_TIMEOUT_MS` (default `30000`).
3. Fecha conexões Redis e Prisma (`OnModuleDestroy`).
4. Loga `Worker shutdown complete` (ou força exit em timeout/falha).

## Migrations

Rode **uma vez** por release na API (ou num job dedicado de migrate). Workers **não** devem executar `prisma migrate deploy`.

## Render (proposta — precisa de aprovação)

**Não aplique isto no `render.yaml` até aprovação.** Mantenha API e worker na **mesma região** (`frankfurt`) na **rede privada** para os dois usarem `DATABASE_URL` / `REDIS_URL` privados.

Fragmento sugerido de Blueprint (worker como **background worker** da Render, mesmo Dockerfile, `--target worker`):

```yaml
# PROPOSTO — anexar em projects[0].environments[0].services
# Aprovação obrigatória antes de merge no render.yaml.

          - type: worker
            name: prospectly-worker
            runtime: docker
            region: frankfurt
            plan: starter
            branch: main
            dockerfilePath: ./apps/api/Dockerfile
            dockerContext: .
            dockerCommand: node dist/worker.js
            # Se usar target BuildKit em vez de override de CMD:
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

Atualize também a descrição/docs do serviço da API para ficar **HTTP + produtores apenas** (sem processors in-process). Escale workers independentes das réplicas HTTP.

> Nota: confirme as chaves exatas do Blueprint (`type: worker` vs `type: background_worker`, e suporte a `dockerBuildTarget`) no [schema do render.yaml](https://render.com/schema/render.yaml.json) antes de aplicar.

## Critérios de aceite

- Escalar workers **não** adiciona réplicas HTTP.
- O shutdown não perde jobs em voo (dentro do timeout; jobs retentam via attempts do BullMQ).
- Falha do worker não derruba a API (processo/serviço separado).
- A API continua disponível se o worker parar (jobs ficam na fila Redis).

## Rollout

1. Implante o serviço worker primeiro (ou junto com a API que já não hospeda processors).
2. Confirme que a profundidade da fila drena e que logs `WorkerBootstrap` aparecem.
3. Só então remova qualquer fallback temporário de worker inline (nenhum enviado nesta mudança).

# Database migrations (production)

Migrations are **not** applied when the API container starts. The production image `CMD` is only:

```text
node dist/main.js
```

See `apps/api/Dockerfile`. This avoids race conditions when multiple web instances boot and keeps schema changes as an explicit, single-writer release step.

## Health checks (already in place)

The API exposes:

| Path | Purpose |
|------|---------|
| `GET /health` | Basic process up |
| `GET /health/live` | Liveness (process alive) |
| `GET /health/ready` | Readiness — **PostgreSQL** (`SELECT 1` via Prisma) **and Redis** (`PING` via BullMQ queue client) |

Render uses `healthCheckPath: /health/ready`. Do not mark a new revision live until readiness passes after migrations (when a release includes schema changes).

## Strategy: single release job

**Rule:** exactly one job (or one CI step) runs `prisma migrate deploy` per release against the target database. Never run migrate from every web replica on start.

Recommended order for a release that includes schema changes:

1. Build and publish the API image (runner target; default Dockerfile stage).
2. Run **one** migrate job/command against production `DATABASE_URL`.
3. Deploy / roll web instances to the new image.
4. Confirm `GET /health/ready` on the new revision.

If the release has **no** schema change, skip step 2.

### Local / CI one-off

```bash
# From repo root, with production DATABASE_URL in the environment
pnpm --filter @prospectly/api exec prisma migrate deploy
```

### Docker migrate target (optional)

The Dockerfile defines a named stage `migrate` (production deps + Prisma CLI + migration files):

```bash
docker build -f apps/api/Dockerfile --target migrate -t prospectly-api-migrate .
docker run --rm -e DATABASE_URL="$DATABASE_URL" prospectly-api-migrate
```

Use this for a Render one-off job or any orchestrator that can run a single task before rolling web.

## Expand / contract (compatibility)

Prefer **expand/contract** so old and new app versions can coexist during rollout:

1. **Expand** — additive, backward-compatible migration (new nullable columns, new tables, new indexes). Deploy migrate job, then roll app code that reads/writes both old and new shapes if needed.
2. **Migrate data** — backfill in a controlled job if required (idempotent).
3. **Contract** — remove obsolete columns/tables only after all instances run code that no longer depends on them (often a later release).

Avoid expand+contract in the same release when rolling instances gradually. Breaking renames should be split across releases (add new → dual-write/read → drop old).

## Rollout

1. Merge to `main` after CI is green (`autoDeployTrigger: checksPass` on Render).
2. If Prisma migrations are in the release: run the **single** migrate job first; confirm exit code 0.
3. Let the API service deploy the new image (`CMD`: `node dist/main.js` only).
4. Verify `GET /health/ready` (Postgres + Redis) and a smoke path (login / one authenticated read).

## Rollback

| Situation | Action |
|-----------|--------|
| New app bad, **no** migrate in release | Redeploy previous API image/revision. |
| New app bad, migrate was **expand-only** (additive) | Redeploy previous API image. Old code typically still works with extra columns/tables. Schedule a later contract if needed. |
| Migrate was **destructive** / incompatible | Do **not** rely on automatic down migrations in production. Restore DB from snapshot/backup taken before migrate, then redeploy previous API image. Prefer avoiding destructive migrations without a tested restore path. |

Always take (or confirm) a DB snapshot/backup before running migrate in production.

## Proposed Render job (needs approval)

Changing `render.yaml` to add a Blueprint job requires explicit approval. **Do not apply the snippet below until reviewed.** Example only:

```yaml
# PROPOSED — not applied to render.yaml until approved
# Place under projects[0].environments[0].services alongside prospectly-api
#
# - type: job
#   name: prospectly-migrate
#   runtime: docker
#   region: frankfurt
#   plan: starter
#   branch: main
#   dockerfilePath: ./apps/api/Dockerfile
#   dockerContext: .
#   # If/when Render supports build target selection for Blueprint jobs:
#   # dockerBuildTarget: migrate
#   # Until then, prefer CI `prisma migrate deploy` or an image built with --target migrate.
#   dockerCommand: npx prisma migrate deploy
#   envVars:
#     - key: DATABASE_URL
#       fromDatabase:
#         name: prospectly-db
#         property: connectionString
```

Until a job is approved and wired, run migrations from a controlled CI/release step (or a manual one-off with the `migrate` image) **once** before rolling the API service.

## Related

- Blueprint overview: [`docs/deploy/render.md`](./render.md)
- API Dockerfile: `apps/api/Dockerfile`
- Health implementation: `apps/api/src/common/health/health.controller.ts`

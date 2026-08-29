# Prospectly ops runbook

Private operational metrics: `GET /api/v1/ops/metrics` (header `X-Prospectly-Ops-Token` matching `OPS_METRICS_TOKEN`, ≥ 32 characters). Tenant JWT roles are not accepted. If the token is unset, the route returns 404. Never expose this route publicly and never put stack traces, lead payloads, or secrets in public health responses.

Queues in scope: `prospecting`, `imports`, `scoring`, `website-analysis`.

## Stuck queue

Symptoms:

- `queues.<name>.waiting` or `delayed` grows while `active` stays at 0
- User actions stay in `PENDING`/`RUNNING` longer than usual
- `jobs.<name>.retries` climbs without `completed`

Actions:

1. Confirm API process is up: `GET /health/live` and `GET /health/ready`.
2. Call `GET /api/v1/ops/metrics` with `X-Prospectly-Ops-Token` and note queue depths + recent fail/retry counters.
3. Check API logs filtered by `correlationId` from the originating HTTP request (`x-correlation-id`).
4. If Redis is healthy but workers appear idle, restart the API service (workers currently run in-process with HTTP).
5. For a single stuck search/import, inspect the entity status in the app/DB. Prefer a controlled retry from the product UI over manual Redis edits.
6. Avoid deleting Redis keys blindly — BullMQ stores job state under queue prefixes.

Escalate if depths keep rising after restart or if failed jobs accumulate with permanent provider errors.

## Redis down

Symptoms:

- `GET /health/ready` returns `503` with `{ "status": "not_ready" }`
- `ops/metrics` reports `redis.status: "down"` (when the process can still serve the ops token)
- Enqueue/rate-limit paths fail; jobs stop progressing

Actions:

1. Verify the Render Key Value (`prospectly-redis`) instance is running and not exhausted.
2. Confirm `REDIS_URL` on the API service and that the policy remains `noeviction` (required for BullMQ).
3. From the API host/network path, test connectivity to Redis (private network only).
4. Restore Redis before forcing job retries. When Redis returns, re-check `health/ready` and queue depths.
5. If data loss occurred on an ephemeral/recreated Redis, expect in-flight jobs to be gone — reconcile pending searches/imports from Postgres state and re-dispatch from the app if needed.

Do not switch Redis to volatile eviction policies.

## Provider failure

Symptoms:

- Prospecting jobs fail with sanitized public messages
- Logs include `provider`, `statusCode`, `reason`, `retryable`, and `correlationId`
- Permanent failures (e.g. Google Places `SERVICE_DISABLED`) stop retrying (`UnrecoverableError`)

Actions:

1. Pull the `correlationId` from the client response header or API error body and find matching processor logs.
2. For retryable provider/network errors: wait for BullMQ backoff; confirm retries in `ops/metrics`.
3. For non-retryable Google Places errors: fix API enablement/key IAM in Google Cloud, then create a new search.
4. For OpenStreetMap/Nominatim rate limits: reduce concurrency/search volume; confirm Redis rate-limiter keys are available.
5. Website analysis SSRF/timeouts are expected for blocked/unreachable URLs — treat as lead-level failures, not platform outages.

Never paste raw provider payloads, API keys, or lead PII into tickets/public channels.

## Rollback

Use when a deploy introduces error spikes, stuck queues, or auth/ops regressions.

1. Identify the bad deploy in Render (API service `prospectly-api`) and the preceding healthy deploy.
2. Roll back the API service to the last known-good deploy. Prefer rolling API + web together when the change crossed the auth cookie/`withCredentials` boundary.
3. Confirm `GET /health/ready` is ready and `GET /api/v1/ops/metrics` (ops token) shows recovering queue depths.
4. Watch `http.errors5xx`, job `failed`/`retries`, and Redis status for 10–15 minutes.
5. If migrations were applied in the bad release, do **not** assume a simple image rollback undoes schema changes — follow Prisma migrate guidance / deploy docs before reprocessing jobs.
6. Communicate impact window and whether users should retry searches/imports.

## Quick checks

| Check | Expected |
|-------|----------|
| `GET /health` | public liveness-style OK, no internals |
| `GET /health/ready` | ready only when Postgres + Redis respond |
| `GET /api/v1/ops/metrics` without `OPS_METRICS_TOKEN` configured | 404 |
| `GET /api/v1/ops/metrics` with missing/wrong `X-Prospectly-Ops-Token` | 401 |
| `GET /api/v1/ops/metrics` with tenant JWT only | 401 (or 404 if token unset) |
| `GET /api/v1/ops/metrics` with matching ops token | JSON with `http`, `jobs`, `queues`, `redis` |

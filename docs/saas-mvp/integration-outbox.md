# Integration outbox pattern (Prospectly)

Outbound CRM/webhook sync must never block the product UX. Use an **outbox** so domain writes stay local and delivery is eventually consistent.

## Flow

1. **Same DB transaction** as the business change (e.g. lead stage update): insert an `OutboxEvent` row (`id`, `organizationId`, `type`, `payload`, `idempotencyKey`, `status=PENDING`).
2. **Worker** polls or listens (`FOR UPDATE SKIP LOCKED` / queue) and delivers to the configured webhook/CRM.
3. Mark `PROCESSED` (or `FAILED` with retry/backoff). Deduplicate with `idempotencyKey` so reprocessing is safe.
4. HTTP handlers only enqueue; they do not `await` the third-party call.

## Why

- Protects latency and availability when HubSpot/Pipedrive/webhooks are slow or down.
- Gives a clear retry surface without double-sending (idempotency).
- Keeps secrets and full payloads out of AuditLog; audit only action + host + counts.

## Current MVP stub

`Integration` with `provider=WEBHOOK` stores the destination URL. Delivery workers and a physical `OutboxEvent` table can land in a later phase; until then, treat this doc as the contract for any sync implementation.

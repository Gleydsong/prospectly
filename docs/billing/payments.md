# Billing payments

## Current routing

Prospectly keeps PIX on AbacatePay and implements hosted card checkout with Asaas behind `ASAAS_ENABLED=false`. Card checkout remains unavailable in production until Sandbox homologation and explicit authorization.

| Product           |    Price | Method                | Provider              |
| ----------------- | -------: | --------------------- | --------------------- |
| 2,000 credits     | R$ 14.99 | PIX                   | AbacatePay            |
| 2,000 credits     | R$ 14.99 | Credit or debit card  | Asaas hosted invoice  |
| 5,000 credits     | R$ 23.99 | PIX                   | AbacatePay            |
| 5,000 credits     | R$ 23.99 | Credit or debit card  | Asaas hosted invoice  |
| Monthly unlimited | R$ 49.99 | PIX                   | AbacatePay            |
| Monthly unlimited | R$ 49.99 | Recurring credit card | Asaas hosted checkout |

The API keeps historical Stripe and AbacatePay identifiers. Existing contracts are not migrated or canceled automatically. There is no Stripe checkout runtime and new card payments must not be routed to Stripe or AbacatePay.

## Safety properties

- Benefits are granted only after an authenticated provider webhook and an authoritative provider read.
- Asaas webhooks are persisted in PostgreSQL before acknowledgment and processed with an atomic lease/reclaim flow.
- Ambiguous Asaas checkout creation becomes `REVIEW_REQUIRED`; the organization cannot create another checkout and no blind retry is made.
- Prospectly stores a minimal organization billing profile but never receives card number, expiry date or CVV.
- Refund and chargeback of packages create an auditable full reversal and may leave a negative credit balance.
- Partial refunds are not converted into partial credits in this MVP. The inbox retains the event as failed for support review instead of silently changing the benefit.
- `ASAAS_ENABLED` defaults to false. Sandbox and production credentials stay outside the repository.

## Sandbox wizard

1. Create or select the Asaas Sandbox account.
2. Store the Sandbox API key in the external secret manager as `ASAAS_API_KEY`.
3. Generate a dedicated webhook token and store the same value as `ASAAS_WEBHOOK_TOKEN`.
4. Configure the Asaas webhook URL as `/api/v1/billing/webhook/asaas` and send the token in `asaas-access-token`.
5. Keep `ASAAS_API_BASE_URL=https://api-sandbox.asaas.com/v3` and enable `ASAAS_ENABLED=true` only in the Sandbox environment.
6. Homologate hosted credit, hosted debit, monthly recurrence, ambiguous timeout, refund and chargeback.
7. Restore `ASAAS_ENABLED=false` after testing. Production activation requires explicit authorization and a controlled financial smoke.

See [Render deployment](../deploy/render.md) for environment and webhook setup.

## `REVIEW_REQUIRED` support runbook

Support must never create another provider request to resolve an uncertain checkout.

1. Locate the local purchase or monthly attempt by organization and copy its `externalId`.
2. Search the Asaas Sandbox/dashboard and payment API using that exact reference. For a monthly checkout, also use the persisted checkout session ID when available.
3. If exactly one matching payment exists, verify customer, amount, method and status, then replay the original authenticated Asaas webhook. The normal inbox processor performs the authoritative GET and resolves the lock.
4. If Asaas confirms that no checkout/payment exists, an authorized operator may change the local attempt to `FAILED` in a tenant-bypassed support transaction and must insert an `AuditLog` row with action `billing.asaas_review_resolved`, the affected entity ID, operator ID and Asaas evidence reference.
5. If there is more than one match, conflicting data or a partial refund, leave the record blocked and escalate to Finance/Engineering. Do not edit credit balance or entitlement directly.

The package reconciler can resolve a lost response automatically because `GET /payments` supports `externalReference`. A monthly checkout with no persisted checkout ID may still require the Asaas dashboard or webhook replay; this runbook is the authorized fallback and does not add a refund/dispute UI or API.

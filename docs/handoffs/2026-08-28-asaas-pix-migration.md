# Asaas PIX migration handoff

## Objective

Route every new Prospectly PIX checkout to Asaas while keeping AbacatePay available only for historical payment events and reconciliation. Preserve Asaas card checkout behavior.

## Approved product contract

| Product           | Payment method | Provider | Benefit                                   |
| ----------------- | -------------- | -------- | ----------------------------------------- |
| 2,000 credits     | PIX            | Asaas    | 2,000 credits after authoritative receipt |
| 5,000 credits     | PIX            | Asaas    | 5,000 credits after authoritative receipt |
| Monthly unlimited | PIX            | Asaas    | 30 paid days, no automatic renewal        |
| Credit packages   | Card           | Asaas    | Existing hosted payment behavior          |
| Monthly unlimited | Credit card    | Asaas    | Existing recurring checkout behavior      |

Pix Automatic is outside this change. Existing AbacatePay and Stripe contracts are historical records and must not be migrated, canceled, or reclassified automatically.

## Required invariants

1. Persist a local checkout attempt before creating an external payment.
2. Use a stable `externalReference` and recover uncertain results through authoritative Asaas lookup.
3. Never retry an ambiguous provider `POST` blindly.
4. Persist authenticated webhook events before returning success.
5. Process duplicate webhook events idempotently.
6. Verify customer, amount, external reference, and `billingType=PIX` using an authenticated Asaas read before granting a benefit. Enforce BRL in the persisted checkout contract and reject a non-BRL provider currency when Asaas returns that optional field; the documented charge response does not expose a mandatory currency field.
7. PIX grants benefits only from the definitive received state. Browser redirects and QR rendering never grant benefits.
8. Reversals remain auditable and may produce a negative credit balance when purchased credits were already consumed.
9. New-provider failure never falls back silently to another provider.
10. AbacatePay webhooks remain operational for historical records.

## Implementation shape

Keep provider complexity local to the Billing module. Extend the existing Asaas client and webhook inbox instead of adding a parallel billing architecture.

- Add `PIX_PROVIDER=ABACATE|ASAAS|DISABLED`, explicitly validated.
- Route new PIX checkout creation through Asaas when configured.
- Extend the discriminated PIX checkout result to allow `provider: ASAAS`.
- Add Asaas payment creation with `billingType=PIX` and QR retrieval through `/payments/{id}/pixQrCode`.
- Reuse durable `CreditPurchase` and `MonthlyCheckoutAttempt` records; add schema only when existing persisted identifiers cannot support safe replay.
- Generalize Asaas package and monthly-attempt claims across PIX and card without weakening the partial unique indexes that prevent concurrent unresolved charges.
- Extend webhook matching and reconciliation so PIX does not require a subscription ID and monthly PIX activates exactly 30 paid days.
- Preserve card-only subscription rules.

## TDD seams

- `POST /api/v1/billing/credits/checkout` and `POST /api/v1/billing/checkout` behavior through `BillingService`.
- Asaas HTTP adapter behavior through `AsaasClient` with mocked external responses.
- `POST /api/v1/billing/webhook/asaas` behavior through `AsaasWebhookService`.
- Web checkout handling through the public `CheckoutResult` contract.

## Verification

Run focused tests after every vertical slice, then:

```bash
pnpm --filter @prospectly/shared-types build
pnpm --filter @prospectly/api prisma:generate
pnpm --filter @prospectly/api test
pnpm --filter @prospectly/web test
pnpm --filter @prospectly/api typecheck
pnpm --filter @prospectly/web typecheck
pnpm lint
pnpm build
```

Run RLS tests against real PostgreSQL with `RUN_RLS_TEST=true` when credentials are available. Sandbox acceptance must prove QR creation, duplicate-click reuse, webhook authentication, duplicate delivery, payment receipt, 30-day activation, package crediting, refund reversal, and card non-regression.

## External gates

Before production:

- Asaas account is fully approved and production API access is enabled.
- A stable PIX key is registered after proof of life.
- Production and Sandbox use different API keys and webhook tokens.
- Production webhook is public, authenticated, active, and returns HTTP 200 after durable persistence.
- Historical AbacatePay pending and reversible records are inventoried.
- A separate Render staging API, web, PostgreSQL, and Redis use only Asaas Sandbox credentials.
- A controlled financial smoke proves settlement, webhook delivery, entitlement, reversal handling, and monitoring.

## Operational boundaries

Implementation and local commits do not authorize push, merge, Render mutation, webhook mutation, payment creation, or production activation. Never place credentials in Git, chat, memory, logs, or documentation.

## Continuation state

Planning was approved on 2026-08-28 in `/Users/guidev/orca/workspaces/prospectly/integracao_asaas`. Reinspect the active branch and `origin/main` before creating any future worktree. A Git worktree does not create a staging environment.

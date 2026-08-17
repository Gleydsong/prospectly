# Dual payment methods (AbacatePay PIX + card) — Brazil only

Prospectly routes **all new checkouts** through **AbacatePay**, always in **BRL**:

| Method | Provider | Credits (2k/5k) | Monthly unlimited |
|--------|----------|-----------------|-------------------|
| PIX | AbacatePay | Transparent PIX (QR in-app) | Transparent PIX → `STARTER_MONTHLY` for **30 days** (no auto-renew) |
| Card | AbacatePay | Hosted checkout `POST /v2/checkouts/create` `methods: ["CARD"]` | Hosted subscription `POST /v2/subscriptions/create` `methods: ["CARD"]` (auto-renew) |

EUR/USD and Europe markets are **not supported**.

Stripe remains **legacy-only**: portal, webhook, and sync for organizations that already have a Stripe subscription. New card sales never call Stripe Checkout.

Credits do **not** lock `Organization.paymentProvider`. Plan checkout does **not** bind the gateway until a confirmed webhook. Stripe `ACTIVE` / `PAST_DUE` orgs cannot start an AbacatePay **plan** until the Stripe subscription is resolved. Stripe `CANCELED` / `INACTIVE` orgs may start AbacatePay. Credits remain purchasable on AbacatePay even with a legacy Stripe plan.

Activation happens **only** after an authenticated AbacatePay webhook. Browser redirects never grant entitlement.

## Environment

### Stripe (legacy only)

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PORTAL_RETURN_URL=
```

Keep the Stripe webhook enabled while any Stripe subscription remains.

### AbacatePay (new PIX + card)

```bash
ABACATE_API_KEY=
ABACATE_WEBHOOK_SECRET=
ABACATE_WEBHOOK_HMAC_KEY=          # optional; defaults to Abacate public HMAC key
ABACATE_PRODUCT_MONTHLY_BRL=       # MONTHLY cycle product
ABACATE_PRODUCT_CREDITS_2000_BRL=  # one-time product, no cycle
ABACATE_PRODUCT_CREDITS_5000_BRL=  # one-time product, no cycle
ABACATE_MONTHLY_AMOUNT_CENTAVOS=4999
ABACATE_SUCCESS_URL=
ABACATE_CANCEL_URL=
ABACATE_API_BASE_URL=https://api.abacatepay.com/v2
ABACATE_HTTP_TIMEOUT_MS=15000
```

Production/staging fail startup if the AbacatePay checkout variables above (except HMAC override and timeout) are empty. Local/test may omit product IDs; checkout then returns `503`.

Do **not** create products at runtime. IDs come from the dashboard.

## External runbook (dashboard — not done by this repo)

1. Create three products in the AbacatePay dashboard:
   - **Prospectly Ilimitado**: BRL, cycle `MONTHLY`.
   - **Prospectly 2.000 créditos**: BRL, one-time (no cycle).
   - **Prospectly 5.000 créditos**: BRL, one-time (no cycle).
2. Store the public product IDs as secrets/env vars.
3. Create an HTTPS v2 webhook pointing to `/api/v1/billing/webhook/abacate?webhookSecret=<secret>`.
4. Select checkout, transparent, and subscription events used by the app (`completed`, `refunded`, `disputed`, `lost` if offered, `subscription.renewed`, `subscription.cancelled`, `subscription.payment_failed`).
5. Grant the API key `checkout`/`billing` create, `subscription` create/delete, and any other permissions required by current AbacatePay docs.
6. Test first with a `devMode` key.
7. Do **not** disable the Stripe webhook while legacy Stripe subscriptions exist.

## App flows

- **Credits + PIX:** `{ mode: 'pix', brCode, ... }` → in-app QR → poll `/billing/status` for credit balance.
- **Credits + card:** `{ mode: 'redirect', provider: 'ABACATE', url }` → AbacatePay hosted checkout. Webhook `checkout.completed` completes `CreditPurchase` once.
- **Monthly + PIX:** transparent PIX → webhook activates monthly for 30 days; renew = new PIX. `currentPeriodEnd` is enforced on search/billing reads (expired orgs drop to FREE). Cancel in-app without a subscription id.
- **Monthly + card:** AbacatePay subscription checkout; `subscription.completed` / `subscription.renewed` keep `STARTER_MONTHLY` + `ACTIVE`. `subscription.payment_failed` → `PAST_DUE`. `subscription.cancelled` → `FREE` + `CANCELED`. Cancel is immediate (`POST /v2/subscriptions/cancel`).
- **Lifetime checkout** is rejected. Existing `LIFETIME` orgs keep access; new sales are credits or monthly.
- **Redirect `/billing/success` never activates entitlement.** The UI polls `/billing/status`.

## Webhooks (AbacatePay API v2)

Payloads are nested. Do not read `data.id` at the wrong level:

- `transparent.*` → `data.transparent`
- `checkout.*` → `data.checkout`
- `subscription.*` → `data.subscription` (+ `data.customer`, `data.payment`, related `data.checkout`)

Correlation order: `metadata.purchaseId` → `CreditPurchase.externalPaymentId` → `CreditPurchase.externalId` → `metadata.organizationId` (org must exist) → `externalId` `org:<id>:…` → persisted `abacateSubscriptionId` / `abacateCustomerId`.

HMAC (`X-Webhook-Signature`) and webhook secret are required. Unknown events return 200 after auth and do not change entitlement.

`ABACATE_WEBHOOK_HMAC_KEY` is optional. Empty or whitespace values must fall back to the Abacate public HMAC key — never treat `""` as a custom secret.

Idempotency: `BillingWebhookEvent.status` `PROCESSING | PROCESSED | FAILED`. Duplicate `PROCESSED` is a no-op. `FAILED` can be retried.

## Cancel / portal

- Legacy Stripe orgs: Billing Portal (`POST /billing/portal`) when `legacyStripeSubscription` / `canOpenPortal`.
- AbacatePay PIX monthly (no subscription id): `POST /billing/cancel` cancels locally (immediate).
- AbacatePay card subscription: `POST /billing/cancel` calls Abacate API (`cancelPolicy: NOW`). Access is lost immediately.

## Data migration notes

`CreditPurchase.paymentMethod` backfill:

- historical `STRIPE` rows → `CARD`
- historical `ABACATE` rows → `PIX` (this product had no Abacate card credits before this change)

Do not invent Stripe→Abacate card migrations. That requires a new customer authorization.

## Removing Stripe (when zero remaining subscriptions)

Do this only after production data shows **no** `Organization` with a live Stripe subscription (`stripeSubscriptionId` set and `planStatus` in `ACTIVE` / `PAST_DUE`).

1. Confirm in production SQL that leftover Stripe rows are canceled/inactive (or already migrated by the customer to AbacatePay).
2. Disable the Stripe webhook endpoint in the Stripe dashboard.
3. Stop sending traffic to `/billing/webhook/stripe` (keep the route returning 4xx/410 for a while if you want a hard fail, then delete).
4. Remove `StripePaymentProvider` portal + webhook code, Stripe env vars, and Render Stripe secrets.
5. Drop unused Stripe columns (`stripeCustomerId`, `stripeSubscriptionId`, related indexes) in a dedicated Prisma migration after a freeze window.
6. Remove `PaymentProvider.STRIPE` from the enum only after no rows still store `STRIPE`.
7. Keep historical `CreditPurchase` / webhook event rows; do not rewrite payment history.

Until that count is zero, keep the Stripe webhook, portal, and sync path.

## Staging checklist

- [ ] Credits PIX: QR → balance increments once
- [ ] Credits card: AbacatePay hosted checkout → webhook completes once; replay does not double-credit
- [ ] Monthly PIX: QR → ACTIVE STARTER_MONTHLY with period end ~30d
- [ ] Monthly card: AbacatePay subscription → ACTIVE; renew keeps ACTIVE; payment_failed → PAST_DUE; cancel → FREE
- [ ] Nested v2 payloads (`data.checkout` / `data.subscription` / `data.customer`)
- [ ] Bad HMAC / wrong secret rejected
- [ ] Processing failure leaves FAILED and allows retry
- [ ] Stripe ACTIVE org cannot start AbacatePay plan; canceled/inactive Stripe can
- [ ] Credit PIX/card allowed while on Stripe plan
- [ ] Stripe portal still works for legacy orgs
- [ ] EUR/USD DTO rejected; prospecting country only `BR`
- [ ] Success page does not claim payment before `/billing/status`

## Out of scope

Coupons, change-plan, Connect/payouts, NF-e, boleto, auto-renew PIX subscription, automatic Stripe→Abacate card migration, AI credit billing.

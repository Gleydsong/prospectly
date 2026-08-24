# Billing: AbacatePay PIX + Appmax card

## Runtime ownership

| Payment method                         | Provider   | Confirmation                              |
| -------------------------------------- | ---------- | ----------------------------------------- |
| PIX, credit packs and 30-day unlimited | AbacatePay | Signed webhook already implemented        |
| Card, credit packs                     | Appmax     | Authenticated `GET /v1/orders/{id}`       |
| Card, monthly unlimited                | Appmax     | Confirmed order, then Appmax subscription |

Stripe is no longer part of the application runtime: there is no SDK, provider, portal or webhook route. Historical database identifiers remain temporarily for financial traceability and must only be dropped after a production audit proves that no active or past-due Stripe subscription remains.

## Prices

- 2,000 credits: `1499` cents (R$ 14.99).
- 5,000 credits: `2399` cents (R$ 23.99).
- Unlimited monthly: `4999` cents (R$ 49.99).

Backend constants are authoritative. The landing page and application display the same values.

## Required Appmax environment

```dotenv
APPMAX_ENABLED=false
APPMAX_CLIENT_ID=
APPMAX_CLIENT_SECRET=
APPMAX_EXTERNAL_ID=
APPMAX_APP_ID=
APPMAX_SITE_ID=
APPMAX_MONTHLY_PRODUCT_ID=
APPMAX_AUTH_BASE_URL=https://auth.sandboxappmax.com.br
APPMAX_API_BASE_URL=https://api.sandboxappmax.com.br
APPMAX_HTTP_TIMEOUT_MS=12000
APPMAX_RECONCILE_INTERVAL_MS=30000
```

Keep `APPMAX_ENABLED=false` during deployment and migration. Set it to `true` only after all Appmax credentials, the monthly product, webhook URLs and sandbox smoke tests are ready. PIX remains available while the card rollout is disabled.

Production must use `https://auth.appmax.com.br` and `https://api.appmax.com.br`. `CLIENT_SECRET` is a Render secret and must never be exposed to the browser. `EXTERNAL_ID` is rendered to the browser because Appmax JS requires it for tokenization.

App installation health check: `GET` or `POST /api/v1/billing/appmax/health`. Webhook: `POST /api/v1/billing/webhook/appmax`.

## Security and entitlement rule

The browser loads `https://scripts.appmax.com.br/appmax.min.js`. PAN, expiry and CVV are tokenized there and never enter the Prospectly API, logs or database. The API accepts only the short-lived token, Appmax-collected IP and required customer/holder fields.

Appmax webhooks have no signature or event ID. They only schedule reconciliation. No entitlement is granted from their body. Credits or unlimited access are released only after an authenticated Appmax API read confirms the expected order, customer and exact amount.

## Idempotency and uncertainty

`AppmaxCheckoutAttempt.checkoutKey` is created once by the browser and persisted before external mutations. The same key returns the existing order and cannot create a second local purchase.

Appmax does not document an idempotency header:

- a lost order-creation response becomes `REVIEW_REQUIRED`; the API does not blindly create another order;
- a lost payment response is recovered with `GET /v1/orders/{id}`;
- a lost subscription response is recovered by listing subscriptions and matching `charges[].order_id` before any further action;
- after bounded unsuccessful recovery, the attempt becomes `REVIEW_REQUIRED` and requires support review.

The reconciler polls pending attempts with backoff and checks active Appmax subscriptions daily. Refund or chargeback confirmation reverses credit benefits idempotently or cancels monthly entitlement.

## Go-live gates

1. Publish and install the private Appmax app; store merchant credentials and `external_id` in Render.
2. Configure the Appmax monthly product ID.
3. Apply the Prisma migration.
4. Register the public Appmax health-check and webhook URLs.
5. Validate sandbox success card `4000000000000010` and failure card `4000000000000028`.
6. Validate order approval, refusal, refund, monthly subscription creation, renewal, failure and cancellation.
7. Confirm CSP/network behavior of Appmax JS and disable session replay on payment fields.
8. Audit production for remaining active/past-due Stripe rows before deleting historical columns or disabling an external legacy webhook.

Full official-doc research and source links: [appmax-card-integration-research.md](./appmax-card-integration-research.md).

# Dual payment gateways (AbacatePay + Stripe)

Prospectly routes billing by **currency**:

| Currency | Provider | Lifetime | Monthly |
|----------|----------|----------|---------|
| BRL | AbacatePay | Transparent PIX (QR in-app) | Hosted subscription, CARD primary |
| EUR / USD | Stripe | Checkout payment | Checkout subscription |

Orgs do **not** migrate between gateways after the first paid binding.

## Environment

### Stripe (EUR/USD)

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_MONTHLY_EUR=
STRIPE_PRICE_MONTHLY_USD=
STRIPE_PRICE_LIFETIME_EUR=
STRIPE_PRICE_LIFETIME_USD=
STRIPE_SUCCESS_URL=
STRIPE_CANCEL_URL=
STRIPE_PORTAL_RETURN_URL=
```

`STRIPE_PRICE_*_BRL` is deprecated for **new** BRL checkouts. Keep only for legacy Stripe-BRL orgs until they expire.

### AbacatePay (BRL)

```bash
ABACATE_API_KEY=
ABACATE_WEBHOOK_SECRET=
ABACATE_WEBHOOK_HMAC_KEY=          # optional; defaults to Abacate public HMAC key
ABACATE_PRODUCT_MONTHLY_BRL=       # product with cycle MONTHLY (CARD)
ABACATE_LIFETIME_AMOUNT_CENTAVOS=39900
ABACATE_SUCCESS_URL=
ABACATE_CANCEL_URL=
ABACATE_API_BASE_URL=https://api.abacatepay.com/v2
```

## Dashboard setup (Abacate)

1. Create a **MONTHLY** product (card). Copy the product id into `ABACATE_PRODUCT_MONTHLY_BRL`.
2. Align lifetime amount with UI price (`ABACATE_LIFETIME_AMOUNT_CENTAVOS`).
3. Create webhook endpoint:
   - URL: `https://<api>/v1/billing/webhook/abacate?webhookSecret=<ABACATE_WEBHOOK_SECRET>`
   - Events: `transparent.completed`, `transparent.refunded`, `transparent.lost`, `subscription.completed`, `subscription.renewed`, `subscription.cancelled`, `checkout.completed` (optional)
4. Verify HMAC via `X-Webhook-Signature` (see Abacate docs).

## Stripe webhook

- Preferred: `POST /v1/billing/webhook/stripe`
- Legacy alias (one release): `POST /v1/billing/webhook`

## App flows

- **BRL + lifetime:** API returns `{ mode: 'pix', brCode, brCodeBase64, ... }`. UI shows QR + copy/paste and polls `GET /billing/status` until `LIFETIME` + `ACTIVE`.
- **BRL + monthly:** API returns `{ mode: 'redirect', url }` to Abacate hosted checkout. PIX is **not** the sole monthly path (CARD methods only on create).
- **EUR/USD:** Stripe redirect as before. Portal only for Stripe orgs.

## Cancel / portal

- Stripe: Billing Portal (`POST /billing/portal`) when `canOpenPortal`.
- Abacate monthly: `POST /billing/cancel` cancels via Abacate API.

## Staging checklist

- [ ] Lifetime BRL: QR appears, pay in sandbox, org becomes ACTIVE LIFETIME
- [ ] Replay `transparent.completed` → idempotent (no double side effects)
- [ ] Monthly BRL CARD: redirect → ACTIVE STARTER_MONTHLY
- [ ] Confirm monthly create does **not** call `/transparents` as only path
- [ ] EUR Stripe checkout + webhook still activate
- [ ] Cross-provider checkout rejected when org already bound
- [ ] Portal hidden for Abacate orgs; cancel works for Abacate monthly

## Out of scope

Coupons, change-plan, Connect/payouts, NF-e, boleto, transparent PIX for monthly, monthly-only PIX, org migration between gateways.

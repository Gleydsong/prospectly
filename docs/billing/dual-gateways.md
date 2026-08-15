# Dual payment methods (AbacatePay PIX + Stripe card) — Brazil only

Prospectly routes billing by **payment method**, always in **BRL**:

| Method | Provider | Credits (2k/5k) | Monthly unlimited |
|--------|----------|-----------------|-------------------|
| PIX | AbacatePay | Transparent PIX (QR in-app) | Transparent PIX → `STARTER_MONTHLY` for **30 days** (no auto-renew) |
| Card | Stripe | Checkout `mode=payment` | Checkout `mode=subscription` (auto-renew) |

EUR/USD and Europe markets are **not supported**.

Credits do **not** lock `Organization.paymentProvider`. Plan checkout locks the org to the plan gateway while ACTIVE.

## Environment

### Stripe (BRL card)

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_MONTHLY_BRL=
STRIPE_PRICE_CREDITS_2000_BRL=
STRIPE_PRICE_CREDITS_5000_BRL=
STRIPE_SUCCESS_URL=
STRIPE_CANCEL_URL=
STRIPE_PORTAL_RETURN_URL=
```

### AbacatePay (BRL PIX)

```bash
ABACATE_API_KEY=
ABACATE_WEBHOOK_SECRET=
ABACATE_WEBHOOK_HMAC_KEY=          # optional; defaults to Abacate public HMAC key
ABACATE_PRODUCT_MONTHLY_BRL=       # legacy CARD subs only (cancel old orgs)
ABACATE_LIFETIME_AMOUNT_CENTAVOS=39900
ABACATE_MONTHLY_AMOUNT_CENTAVOS=4999
ABACATE_SUCCESS_URL=
ABACATE_CANCEL_URL=
ABACATE_API_BASE_URL=https://api.abacatepay.com/v2
```

## App flows

- **Credits + PIX:** `{ mode: 'pix', brCode, ... }` → in-app QR → poll `/billing/status` for credit balance.
- **Credits + card:** `{ mode: 'redirect', url }` → Stripe Checkout.
- **Monthly + PIX:** transparent PIX → webhook activates monthly for 30 days; renew = new PIX. `currentPeriodEnd` is enforced on search/billing reads (expired orgs drop to FREE). Cancel in-app without a subscription id.
- **Monthly + card:** Stripe subscription redirect; portal for cancel/manage (no in-app cancel).
- **Lifetime checkout** is rejected. Existing `LIFETIME` orgs keep access; new sales are credits or monthly.
- **Abacate legacy CARD subscription:** still cancelable via `POST /billing/cancel` when `abacateSubscriptionId` is set.

## Cancel / portal

- Stripe card orgs: Billing Portal (`POST /billing/portal`).
- Abacate PIX monthly (no subscription id): `POST /billing/cancel` cancels locally.
- Abacate legacy CARD sub: `POST /billing/cancel` calls Abacate API.

## Staging checklist

- [ ] Credits PIX: QR → balance increments
- [ ] Credits card: Stripe test Checkout → balance increments
- [ ] Monthly PIX: QR → ACTIVE STARTER_MONTHLY with period end ~30d
- [ ] Monthly card: Stripe subscription → ACTIVE
- [ ] Replay webhooks → idempotent
- [ ] Cross-provider **plan** checkout rejected when org already ACTIVE on other gateway
- [ ] Credit PIX allowed while on Stripe plan (and vice versa)
- [ ] EUR/USD DTO rejected; prospecting country only `BR`

## Out of scope

Coupons, change-plan, Connect/payouts, NF-e, boleto, auto-renew PIX subscription, org migration between plan gateways, AI credit billing.

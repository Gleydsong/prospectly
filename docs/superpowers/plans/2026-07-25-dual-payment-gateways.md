# Dual Payment Gateways (AbacatePay BR + Stripe EU) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Status:** IMPLEMENTED on branch `feat/dual-payment-gateways-abacate-stripe` (staging checklist pending)

**Goal:** Permitir checkout com **AbacatePay para BRL (Brasil)** e **Stripe para EUR/USD (Europa e demais)**, mantendo um único domínio de billing no Prospectly — com **PIX de verdade (QR na tela) no vitalício** e **cartão/recorrência no mensal**.

**Architecture:** Extrair uma interface `PaymentProvider` com dois adapters (`StripePaymentProvider`, `AbacatePaymentProvider`). `BillingService` resolve o provider pela moeda e o **modo de cobrança pelo `interval`**: BRL+lifetime → Checkout Transparente PIX (QR); BRL+monthly → assinatura Abacate priorizando cartão (PIX só como complemento no hosted, nunca como único meio); EUR/USD → Stripe. Frontend trata resposta discriminada: `redirect` (URL) ou `pix` (QR + copia-e-cola).

**Tech Stack:** NestJS, Prisma/PostgreSQL, Stripe SDK, AbacatePay REST API v2 (`/transparents`, `/subscriptions`, `/checkouts`), webhooks HMAC, React (tela PIX), Jest/Vitest.

## Global Constraints

- Roteamento **somente por moeda** (não por IP): `BRL → ABACATE`, `EUR|USD → STRIPE`
- **BRL + lifetime:** Checkout Transparente PIX (`POST /transparents/create`, `method: "PIX"`) — QR + `brCode` na UI do app; ativação via webhook `transparent.completed`
- **BRL + monthly:** Assinatura Abacate (`POST /subscriptions/create`, produto `cycle: MONTHLY`) com **CARTÃO como meio principal**; se o hosted Abacate expor PIX, tratar só como complemento — **não** oferecer fluxo mensal “somente PIX”
- **EUR/USD:** Stripe Checkout hospedado (subscription ou payment) como hoje
- Org **não migra de gateway** após primeiro pagamento pago (bloquear troca de moeda cross-provider)
- Idempotência de webhook obrigatória para ambos os providers
- Secrets só via env; nunca logar API keys / payloads sensíveis / brCode em logs de produção
- Manter `assertCanCreateSearch` e free limit intactos
- Zero em-dashes em copy de UI/docs voltados ao usuário

## Decisões travadas (revisar antes de executar)

| # | Decisão | Valor |
|---|--------|--------|
| D1 | Gateways + meios BR | **AbacatePay (BRL)** + **Stripe (EUR, USD)**. No BR: **vitalício = PIX transparente (QR na tela)**; **mensal = cartão/recorrência Abacate** (PIX apenas complemento no hosted, nunca único meio). |
| D2 | UX checkout | **Mista:** PIX in-app (lifetime BRL); redirect hosted (monthly BRL + Stripe EUR/USD) |
| D3 | Mensal BR | Assinatura Abacate (`cycle: MONTHLY`), métodos padrão **CARD**; PIX não é o caminho principal |
| D4 | Vitalício BR | Transparent PIX Abacate (`amount` em centavos do preço lifetime BRL); UI com QR + copia-e-cola + polling/status até webhook |
| D5 | Portal cliente | Stripe Billing Portal (EUR/USD); cancelamento via API Abacate (BRL mensal) |
| D6 | CPF/CNPJ | Transparent PIX: enviar `customer` (email + name; `taxId` se a API exigir). Assinatura hosted: preferir coleta no lado Abacate |
| D7 | Produtos / preços Abacate | Produto monthly via env; lifetime PIX usa `ABACATE_LIFETIME_AMOUNT_CENTAVOS` (ex.: 99700) alinhado a `DISPLAY_PRICES.lifetime.BRL` |
| D8 | Modelo Prisma | `paymentProvider` + IDs Abacate; manter Stripe IDs; opcional `abacatePaymentId` para cobrança PIX lifetime |
| D9 | Webhooks | `/billing/webhook/stripe`, `/billing/webhook/abacate`; alias `/billing/webhook` → Stripe 1 release |
| D10 | Fora de escopo | Cupons Abacate, change-plan, Connect/payouts, NF automática, boleto, Checkout Transparente para **mensal**, PIX como único meio do plano mensal, migração de org entre gateways |

## Mapa de arquivos

### Criar

| Arquivo | Responsabilidade |
|---------|------------------|
| `apps/api/src/modules/billing/domain/payment-provider.ts` | Interface + tipos (`CheckoutResult` discriminado) |
| `apps/api/src/modules/billing/domain/payment-router.ts` | `resolveProvider(currency)` |
| `apps/api/src/modules/billing/infrastructure/stripe.payment-provider.ts` | Adapter Stripe |
| `apps/api/src/modules/billing/infrastructure/abacate.payment-provider.ts` | Adapter Abacate (PIX + subscription) |
| `apps/api/src/modules/billing/infrastructure/abacate.client.ts` | HTTP: transparents, subscriptions, cancel |
| `apps/api/src/modules/billing/billing-activation.service.ts` | Ativação/cancelamento na `Organization` |
| `apps/api/prisma/migrations/..._dual_payment_providers/migration.sql` | Schema |
| `apps/web/src/pages/billing/pix-checkout-page.tsx` (ou modal) | Tela QR PIX lifetime |
| `apps/web/src/features/billing/*` | Hooks status/checkout |
| `docs/billing/dual-gateways.md` | Runbook |

### Modificar

| Arquivo | Mudança |
|---------|---------|
| `apps/api/prisma/schema.prisma` | Provider + IDs Abacate + webhook events |
| `billing.service.ts` / `controller.ts` / `module.ts` | Router, PIX vs redirect, webhooks |
| `configuration.ts` / `validation.ts` / `.env.example` | Env Abacate + amount lifetime |
| Web settings + i18n | Portal condicional; fluxo “Pagar com PIX” no vitalício BRL |
| Landing pricing (opcional) | Mencionar PIX no vitalício BRL |

### Contrato do adapter

```ts
export type PaymentProviderId = 'STRIPE' | 'ABACATE';

export type CheckoutRequest = {
  organizationId: string;
  customerEmail: string;
  customerName?: string;
  interval: 'monthly' | 'lifetime';
  currency: 'BRL' | 'EUR' | 'USD';
  successUrl: string;
  cancelUrl: string;
  existingCustomerId?: string | null;
};

/** Resposta discriminada: redirect (Stripe / assinatura BR) ou PIX in-app (vitalício BR). */
export type CheckoutResult =
  | {
      mode: 'redirect';
      url: string;
      provider: PaymentProviderId;
      externalCustomerId?: string;
      externalCheckoutId?: string;
    }
  | {
      mode: 'pix';
      provider: 'ABACATE';
      brCode: string;
      brCodeBase64: string;
      externalPaymentId: string;
      amountCentavos: number;
      expiresAt?: string;
    };

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  createCheckout(input: CheckoutRequest): Promise<CheckoutResult>;
  createPortal?(input: {
    organizationId: string;
    externalCustomerId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;
  cancelSubscription?(input: {
    organizationId: string;
    externalSubscriptionId: string;
  }): Promise<void>;
  verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ eventId: string; type: string; payload: unknown }>;
  applyWebhookEvent(payload: unknown): Promise<{
    handled: boolean;
    eventId: string;
    type: string;
  }>;
}

export function resolvePaymentProviderId(
  currency: 'BRL' | 'EUR' | 'USD',
): PaymentProviderId {
  if (currency === 'BRL') return 'ABACATE';
  return 'STRIPE';
}
```

**Regra no `AbacatePaymentProvider.createCheckout`:**

```ts
if (input.interval === 'lifetime') {
  // POST /transparents/create { method: 'PIX', data: { amount: LIFETIME_CENTAVOS, ... } }
  // return { mode: 'pix', brCode, brCodeBase64, externalPaymentId, ... }
}
// monthly:
// POST /subscriptions/create with CARD-first product/methods
// return { mode: 'redirect', url }
```

### Schema Prisma (alvo)

```prisma
enum PaymentProvider {
  STRIPE
  ABACATE
}

model Organization {
  paymentProvider       PaymentProvider?
  stripeCustomerId      String?  @unique
  stripeSubscriptionId  String?  @unique
  abacateCustomerId     String?  @unique
  abacateSubscriptionId String?  @unique
  abacatePaymentId      String?  @unique  // cobrança PIX lifetime (transparent id)
}

model BillingWebhookEvent {
  id        String          @id @default(uuid())
  provider  PaymentProvider
  eventId   String
  createdAt DateTime        @default(now())

  @@unique([provider, eventId])
}
```

### Env novas (Abacate)

```bash
ABACATE_API_KEY=
ABACATE_WEBHOOK_SECRET=
ABACATE_PRODUCT_MONTHLY_BRL=          # produto com cycle MONTHLY (cartão)
ABACATE_LIFETIME_AMOUNT_CENTAVOS=99700
ABACATE_SUCCESS_URL=
ABACATE_CANCEL_URL=
ABACATE_API_BASE_URL=https://api.abacatepay.com/v2
```

Deprecar path de checkout `STRIPE_PRICE_*_BRL`.

### Eventos Abacate (MVP)

| Evento | Efeito |
|--------|--------|
| `transparent.completed` | Lifetime PIX pago → STARTER + lifetime + BRL |
| `transparent.refunded` / `transparent.lost` | Reverter / não ativar |
| `subscription.completed` / `subscription.renewed` | STARTER monthly |
| `subscription.cancelled` | Espelhar política Stripe |
| `checkout.completed` | Só se monthly usar hosted checkout complementar — ativar monthly |

HMAC: confirmar em https://docs.abacatepay.com/pages/webhooks/reference na Task 4.

---

### Task 1: Migration + enums Prisma

**Files:** `apps/api/prisma/schema.prisma`, nova migration

- [x] Enum/campos/`BillingWebhookEvent` / `abacatePaymentId`
- [x] Migrar eventos Stripe existentes
- [x] `prisma generate` + `prisma validate`

---

### Task 2: Domain — router + activation

**Files:** `domain/payment-provider.ts`, `payment-router.ts` + specs, `billing-activation.service.ts` + spec

- [x] Testes router BRL/EUR/USD
- [x] Activation para monthly, lifetime, cancel
- [x] Tipos `CheckoutResult` discriminados exportados

**Test:** `pnpm --filter @prospectly/api test -- payment-router billing-activation`

---

### Task 3: Refatorar Stripe para adapter

**Files:** `stripe.payment-provider.ts`, `billing.service.ts`, module, specs, controller alias

- [x] Stripe retorna sempre `{ mode: 'redirect', url }`
- [x] EUR/USD verdes; webhook compat

**Test:** `pnpm --filter @prospectly/api test -- billing.service`

---

### Task 4: Cliente + adapter AbacatePay (PIX + assinatura)

**Files:** `abacate.client.ts`, `abacate.payment-provider.ts`, specs, config/env

**Fluxos:**
1. **Lifetime BRL** → `POST /transparents/create` (`method: "PIX"`, amount centavos) → `{ mode: 'pix', brCode, brCodeBase64, externalPaymentId }`
2. **Monthly BRL** → `POST /subscriptions/create` (CARD-first) → `{ mode: 'redirect', url }`
3. **Cancel monthly** → `POST /subscriptions/cancel`
4. **Webhook** → `transparent.*` + `subscription.*` → activation

- [x] Unit tests mockando HTTP (PIX e monthly)
- [x] Garantir que monthly **não** chama `/transparents` como caminho único
- [x] Falhar se amount/product env ausente

**Test:** `pnpm --filter @prospectly/api test -- abacate`  
**Ref:** https://docs.abacatepay.com/llms.txt (transparents + subscriptions)

---

### Task 5: Controller + UI (redirect + tela PIX)

**Files:** billing controller/service; web PIX page/modal; settings; i18n

| Rota | Comportamento |
|------|----------------|
| `POST /billing/checkout` | Router; response = `CheckoutResult` |
| `POST /billing/webhook/abacate` | Inclui `transparent.completed` |
| `POST /billing/portal` | Só STRIPE |
| `POST /billing/cancel` | Assinatura Abacate/Stripe |

**UI vitalício BRL:**
- [x] Se `mode === 'pix'`: QR (`brCodeBase64`), copiar `brCode`, valor, “Aguardando pagamento”
- [x] Polling `GET /billing/status` até ACTIVE (2–3s, timeout ~15 min) ou redirect success após webhook
- [x] Se `mode === 'redirect'`: `window.location = url`

**UI mensal BRL:**
- [x] Copy de pagamento recorrente no cartão; não vender como “só PIX”

- [x] Bloquear checkout cross-provider
- [x] `GET /billing/status` → `paymentProvider`, `canOpenPortal`

---

### Task 6: Runbook

**Files:** `docs/billing/dual-gateways.md` + link README

- [x] Produto monthly CARD, amount lifetime, webhook (`transparent.*`, `subscription.*`)
- [x] Testes sandbox: PIX lifetime + subscription monthly + Stripe EUR
- [x] Documentar: PIX não é meio único do mensal

---

### Task 7: Verificação final

- [x] Testes + typecheck API e web
- [ ] Staging: PIX lifetime (QR) → ACTIVE; monthly CARD → ACTIVE; EUR Stripe → ACTIVE
- [x] Idempotência de `transparent.completed`
- [x] Confirmar que não existe fluxo mensal “apenas PIX” na UI

---

## Ordem

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7
```

## Riscos

| Risco | Mitigação |
|-------|-----------|
| HMAC / shape webhook transparent | Spike Task 4 com sandbox |
| Usuário fecha tela antes do PIX | Polling status; cobrança pode expirar no Abacate |
| Assinatura Abacate só CARD | Alinhar produto no dashboard; copy UI honesta |
| Orgs antigas Stripe BRL | Manter até expirar; novos BRL só Abacate |

## Critérios de aceite

1. `BRL + lifetime` → `mode: 'pix'` com QR utilizável na UI  
2. `BRL + monthly` → `mode: 'redirect'` (cartão/recorrência); **não** QR como único caminho  
3. `EUR|USD` → Stripe redirect  
4. `transparent.completed` ativa STARTER lifetime  
5. `subscription.completed/renewed` ativa STARTER monthly  
6. Webhook Stripe intacto  
7. Portal só Stripe; cancel BR via API  
8. Cross-provider rejeitado  
9. Testes + runbook atualizados  

## Fora deste plano

- Deploy Render, NF-e, boleto, cupons, change-plan, Connect/payouts  
- PIX transparente no **plano mensal** / mensal só PIX  
- HttpOnly cookies, remoção manual de prices BRL no dashboard Stripe  

## Self-review

- D1 e D10 alinhados à recomendação PIX vitalício + cartão mensal  
- Global constraints, D2–D4, Tasks 4–5, aceite e riscos atualizados  
- `CheckoutResult` discriminado cobre QR e redirect  
- Transparent PIX **entro** no escopo; **sai** de D10  

# Spec: Configuração pendente para Go Live (envs)

> **Status:** OPEN — checklist operacional  
> **Data:** 2026-07-25  
> **Branch base:** `main` (`render.yaml`, dual billing)  
> **Relacionado:** [`docs/deploy/render.md`](../deploy/render.md), [`docs/billing/dual-gateways.md`](../billing/dual-gateways.md)

## 1. Objetivo

Documentar **tudo que ainda falta configurar** (variáveis de ambiente e wiring externo) para colocar o Prospectly em produção no Render, sem misturar com código ainda não implementado (ex.: SDK Sentry, OAuth).

## 2. Escopo

### Dentro

- Envs `sync: false` do Blueprint (`render.yaml`)
- Envs build-time do web (Vite) e landing (Next)
- Webhooks Stripe / Abacate
- Gaps do `.env` local vs o necessário para smoke de billing/e-mail

### Fora

- Implementar SEC-001 (HttpOnly cookies)
- Instrumentar Sentry SDK
- OAuth GitHub (env existe, código não)
- Self-host OSM / backups automatizados (ops pós-Go-Live)

> **Nota:** OAuth Google (ID token + `POST /auth/google`) foi implementado; configurar `GOOGLE_CLIENT_ID` (API) e `VITE_GOOGLE_CLIENT_ID` (web).

## 3. Já provisionado pelo Blueprint (não falta)

Estas entram automaticamente no sync do `render.yaml`:

| Variável | Origem |
|----------|--------|
| `DATABASE_URL` | `fromDatabase` → `prospectly-db` |
| `REDIS_URL` | `fromService` → `prospectly-redis` |
| `JWT_ACCESS_SECRET` | `generateValue` |
| `JWT_REFRESH_SECRET` | `generateValue` |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |
| `ABACATE_LIFETIME_AMOUNT_CENTAVOS` | `39900` |
| `ABACATE_API_BASE_URL` | `https://api.abacatepay.com/v2` |
| `OSM_USER_AGENT` | `Prospectly/1.0 (...)` |
| `SMTP_PORT` | `587` |
| `LOG_LEVEL` | `info` |
| `PORT` | injetado pelo Render |

## 4. Pendente — Must (bloqueia Go Live pago)

Preencher no **Dashboard Render** na primeira aplicação do Blueprint (`sync: false`), depois ajustar URLs quando os serviços tiverem hostname público.

### 4.1 API — `prospectly-api`

| # | Variável | Obrigatoriedade | Formato / exemplo | Critério de aceite |
|---|----------|-----------------|-------------------|--------------------|
| A1 | `FRONTEND_URL` | Must | `https://<web>.onrender.com` | Redirects e links do app apontam para o web |
| A2 | `CORS_ORIGINS` | Must | `https://<web>,https://<landing>` (vírgula) | Login/register/API do browser sem erro CORS |
| A3 | `STRIPE_SECRET_KEY` | Must (EUR/USD) | `sk_test_...` depois `sk_live_...` | Checkout EUR/USD cria sessão |
| A4 | `STRIPE_WEBHOOK_SECRET` | Must | `whsec_...` | `POST /api/v1/billing/webhook/stripe` aceita evento |
| A5 | `STRIPE_PRICE_MONTHLY_EUR` | Must | `price_...` | Checkout monthly EUR |
| A6 | `STRIPE_PRICE_MONTHLY_USD` | Must | `price_...` | Checkout monthly USD |
| A7 | `STRIPE_PRICE_LIFETIME_EUR` | Must | `price_...` | Checkout lifetime EUR |
| A8 | `STRIPE_PRICE_LIFETIME_USD` | Must | `price_...` | Checkout lifetime USD |
| A9 | `STRIPE_SUCCESS_URL` | Must | `https://<web>/billing/success?session_id={CHECKOUT_SESSION_ID}` | Retorno pós-pago Stripe |
| A10 | `STRIPE_CANCEL_URL` | Must | `https://<web>/billing/cancel` | Cancelamento Stripe |
| A11 | `STRIPE_PORTAL_RETURN_URL` | Must | `https://<web>/settings` | Portal Stripe retorna ao app |
| A12 | `ABACATE_API_KEY` | Must (BRL) | Bearer key Abacate | Transparent PIX + subscription |
| A13 | `ABACATE_WEBHOOK_SECRET` | Must | secret do webhook | Query `?webhookSecret=` válida |
| A14 | `ABACATE_PRODUCT_MONTHLY_BRL` | Must | produto `cycle: MONTHLY` | Monthly BRL redirect CARD |
| A15 | `ABACATE_SUCCESS_URL` | Must | `https://<web>/billing/success` | Retorno assinatura BRL |
| A16 | `ABACATE_CANCEL_URL` | Must | `https://<web>/billing/cancel` | Cancel hosted BRL |
| A17 | `SMTP_HOST` | Must* | hostname SMTP | *Must se forgot-password for requisito de launch |
| A18 | `SMTP_USER` | Must* | usuário | Auth SMTP |
| A19 | `SMTP_PASSWORD` | Must* | senha / app password | Auth SMTP |
| A20 | `SMTP_FROM` | Must* | `no-reply@dominio.com` | Remetente |
| A21 | `GOOGLE_CLIENT_ID` | Must (se Google Sign-In) | OAuth Web Client ID | Verifica ID token em `POST /auth/google` |

\*SMTP: se o launch aceitar “reset só via suporte”, pode ir para Should; o código ainda não envia e-mail até SMTP + implementação do TODO phase-6 estarem ok — tratar SMTP como Must para Go Live completo de auth.

### 4.2 Web — `prospectly-web` (build-time)

| # | Variável | Exemplo | Critério de aceite |
|---|----------|---------|--------------------|
| W1 | `VITE_API_URL` | `https://<api>.onrender.com/api/v1` | App chama API correta |
| W2 | `VITE_LANDING_URL` | `https://<landing>.onrender.com` | Links “ver preços” / termos |
| W3 | `VITE_GOOGLE_CLIENT_ID` | mesmo valor que `GOOGLE_CLIENT_ID` | Botão Google no login/register |

**Obrigatório:** após setar, **rebuild/redeploy** do static site.

### 4.3 Landing — `prospectly-landing` (build-time)

| # | Variável | Exemplo | Critério de aceite |
|---|----------|---------|--------------------|
| L1 | `NEXT_PUBLIC_APP_URL` | `https://<web>.onrender.com` | CTAs pricing → app |
| L2 | `NEXT_PUBLIC_LANDING_URL` | `https://<landing>.onrender.com` | metadataBase / sitemap / robots |
| L3 | `NEXT_PUBLIC_API_URL` | `https://<api>.onrender.com/api/v1` | Se a landing consumir API |

**Obrigatório:** rebuild/redeploy da landing.

### 4.4 Wiring externo (não é env, mas bloqueia billing)

| # | Item | Valor |
|---|------|--------|
| X1 | Stripe webhook endpoint | `https://<api>/api/v1/billing/webhook/stripe` |
| X2 | Abacate webhook endpoint | `https://<api>/api/v1/billing/webhook/abacate?webhookSecret=<ABACATE_WEBHOOK_SECRET>` |
| X3 | Eventos Abacate | `transparent.completed`, `transparent.refunded`, `transparent.lost`, `subscription.completed`, `subscription.renewed`, `subscription.cancelled` (+ opcional `checkout.completed`) |
| X4 | Produto Abacate monthly | CARD / `MONTHLY`, id em `ABACATE_PRODUCT_MONTHLY_BRL` |

## 5. Pendente — Should

| Variável | Serviço | Nota |
|----------|---------|------|
| `SENTRY_DSN` | api | Já no Blueprint; **SDK não instrumentado** — valor hoje inerte |
| `GOOGLE_PLACES_API_KEY` | api | Só se ativar provider Google; OSM funciona sem |
| `ABACATE_WEBHOOK_HMAC_KEY` | api | Opcional; default = chave pública da doc Abacate |

## 6. Explicitamente fora / ignore

| Variável | Motivo |
|----------|--------|
| `GITHUB_CLIENT_*` | Sem implementação OAuth GitHub |
| `GOOGLE_CLIENT_SECRET` | Fluxo atual usa só ID token (Client ID); secret não é necessário |
| `STRIPE_PRICE_*_BRL` | Depreciado para novos checkouts BRL (Abacate) |
| `YELP_API_KEY`, `PAGESPEED_API_KEY` | Fase futura |
| `OSM_NOMINATIM_URL`, `OSM_OVERPASS_URL`, CSV_* | Defaults públicos ok para MVP |

## 7. Estado local (dev) — gaps atuais

Snapshot da máquina de desenvolvimento (nomes apenas; sem valores):

| App | Presente | Falta |
|-----|----------|-------|
| `apps/api/.env` | `DATABASE_URL`, `REDIS_URL`, JWT_*, `FRONTEND_URL`, `CORS_ORIGINS`, `GOOGLE_PLACES_API_KEY`, `LOG_LEVEL`, `NODE_ENV`, `PORT` | Todo Stripe, todo Abacate, SMTP_*, `SENTRY_DSN` |
| `apps/web/.env` | `VITE_API_URL` | `VITE_LANDING_URL` |
| `apps/landing/.env` | **arquivo ausente** | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_LANDING_URL`, `NEXT_PUBLIC_API_URL` |

## 8. Ordem de execução recomendada

```text
1. Aplicar Blueprint Render (render.yaml)
2. Preencher A3–A20 (secrets billing + SMTP) no Dashboard
3. Aguardar URLs públicas dos 3 serviços
4. Preencher A1–A2, W1–W2, L1–L3
5. Rebuild web + landing
6. Configurar X1–X4 (webhooks + produto)
7. Smoke: GET /health/ready → register/login → checkout test EUR → PIX BRL → monthly BRL
```

## 9. Critérios de aceite do spec

- [ ] Todas as linhas **Must** da seção 4 marcadas como configuradas no ambiente de produção
- [ ] Webhooks X1–X3 recebendo eventos de teste
- [ ] Checklist de staging em `docs/billing/dual-gateways.md` executada
- [ ] `GET /health/ready` → `ready`
- [ ] Este documento atualizado: Status → `DONE` quando fechado

## 10. Referências

- Blueprint: [`render.yaml`](../../render.yaml)
- Runbook deploy: [`docs/deploy/render.md`](../deploy/render.md)
- Billing: [`docs/billing/dual-gateways.md`](../billing/dual-gateways.md)
- Examples: `apps/api/.env.example`, `apps/web/.env.example`, `apps/landing/.env.example`

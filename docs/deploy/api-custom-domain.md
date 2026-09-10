# Domínio próprio da API (`api.prospectlyonboard.com`)

Issue: [Spec: Domínio próprio da API (OAuth/cookies/CORS)](https://github.com/Gleydsong/prospectly/issues/179).

A API HTTP ainda responde em `https://prospectly-api.onrender.com`. O app já está em `https://app.prospectlyonboard.com`. Cookie de refresh, CORS e redirect da Conexão Google atravessam sites diferentes. O host canónico é `api.prospectlyonboard.com` (CNAME para o serviço Render `prospectly-api`).

O worker continua interno. Produção Asaas (`api.asaas.com`) **não** entra neste cutover.

## Wizard (ticket 1 — humano)

Não inventar secrets. Não colar chaves na issue.

```bash
./scripts/api-custom-domain-wizard.sh
```

Entrega do ticket 1: o host resolve, TLS no Render está ok, env público actualizado no Dashboard. O CNAME **ainda não** responde até este passo humano existir — o ticket 2 no git (app a falar só com o host novo) espera esse health.

## DNS / TLS

1. Render → `prospectly-api` → Settings → Custom Domains → `api.prospectlyonboard.com`.
2. Namecheap → Advanced DNS → CNAME `api` → `prospectly-api.onrender.com` (ou o hostname exacto que a Render mostrar).
3. Esperar verificação + certificado. Probe:

```bash
curl -i https://api.prospectlyonboard.com/health/ready
```

## Cookie (SEC-001)

`onrender.com` é public suffix: `*.onrender.com` **não** são same-site entre si. Enquanto o app chamar `prospectly-api.onrender.com`, produção usa `REFRESH_COOKIE_SAME_SITE=none` + `Secure` e CSRF `X-Requested-With`.

Quando o browser fala com `app.prospectlyonboard.com` **e** `api.prospectlyonboard.com`, passam a ser same-site / cross-origin. Aí `SameSite=Lax` + `Secure`, cookie **host-only** (sem `Domain=`).

Não mudes para `lax` no mesmo instante em que `VITE_API_URL` ainda aponta para `onrender.com` — o cookie deixa de ser enviado.

Deploy API + web juntos.

## Env público (colar no Dashboard, não nesta doc)

| Variável | Serviço | Valor alvo |
| --- | --- | --- |
| `FRONTEND_URL` | api | `https://app.prospectlyonboard.com` |
| `CORS_ORIGINS` | api | `https://app.prospectlyonboard.com,https://prospectlyonboard.com,https://www.prospectlyonboard.com` (sem `*`) |
| `GOOGLE_OAUTH_REDIRECT_URI` | api (+ worker se existir) | `https://api.prospectlyonboard.com/api/v1/google-connections/callback` |
| `REFRESH_COOKIE_SAME_SITE` | api | `lax` **só** com o web já no host novo |
| `VITE_API_URL` | web (rebuild) | `https://api.prospectlyonboard.com/api/v1` |
| `NEXT_PUBLIC_API_URL` | landing (rebuild) | o mesmo |

`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: tira newline no fim depois de colar no Render (`invalid_client`). O boot da API já faz `.trim()` nestes valores.

Google Cloud Console: adiciona o redirect URI novo e **mantém** `https://prospectly-api.onrender.com/api/v1/google-connections/callback` no overlap.

## Webhook Asaas (sandbox)

URL nova: `https://api.prospectlyonboard.com/api/v1/billing/webhook/asaas`.

Overlap: webhook extra com o mesmo `ASAAS_WEBHOOK_TOKEN`. Não apagues o URL velho até desligar o host onrender no cliente. Não uses `api.asaas.com`.

## Probe Playwright

O spec `apps/web/e2e/api-custom-domain.probe.spec.ts` faz skip se o CNAME não resolver:

```bash
pnpm --filter @prospectly/web exec playwright test --config playwright.probe.config.ts
```

Depois do DNS: health 200, `Access-Control-Allow-Origin: https://app.prospectlyonboard.com`, credentials true. Login cookie e callback OAuth continuam manuais (`invalid_grant` ≠ `invalid_client`).

## Tickets

1. Wizard DNS/TLS/OAuth/env — este documento + script.
2. Código no cliente a falar só com o host novo — **bloqueado** enquanto `health/ready` no host novo falhar.
3. Overlap: tirar URI/onrender velhos no Console e no cliente.

## Fora de escopo

Ligar `api.asaas.com`, Microsoft/MCP, mudar o domínio do app, feature flags por org.

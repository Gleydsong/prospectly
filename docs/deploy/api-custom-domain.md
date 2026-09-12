# Domínio próprio da API (`api.prospectlyonboard.com`)

Issue: [Spec: Domínio próprio da API (OAuth/cookies/CORS)](https://github.com/Gleydsong/prospectly/issues/179).

Produção fala só com `https://api.prospectlyonboard.com`. O app está em `https://app.prospectlyonboard.com`. Cookie de refresh: `SameSite=Lax` + `Secure`, **host-only** (sem `Domain=`). CORS: lista explícita, sem `*`.

O worker continua interno. Produção Asaas (`api.asaas.com`) **não** entra neste cutover.

O subdomínio `https://prospectly-api.onrender.com` está **desligado** (Render Subdomain disabled). Pedidos públicos devolvem **404** com `x-render-routing: blocked-render-subdomain` — não há redirect para o host canónico. Rollback: Settings → Custom Domains → Render Subdomain → Enabled.

O CNAME `api` no Namecheap **continua** a apontar para `prospectly-api.onrender.com`. Isso é o alvo DNS interno da Render; não reactivar o subdomínio público.

Não desligar o onrender do **web** (`prospectly-web.onrender.com`).

## Estado actual (tickets 1–3)

| Check | Estado |
| --- | --- |
| CNAME + TLS + `GET /health/ready` no host novo | 200 |
| App `VITE_API_URL` | `https://api.prospectlyonboard.com/api/v1` |
| `REFRESH_COOKIE_SAME_SITE` | `lax` |
| Google redirect URI | só `https://api.prospectlyonboard.com/api/v1/google-connections/callback` |
| Webhook Asaas sandbox | só a URL no host novo |
| `prospectly-api.onrender.com` | 404 Render, sem redirect |

## Wizard (ticket 1 — humano, já corrido)

Não inventar secrets. Não colar chaves na issue.

```bash
./scripts/api-custom-domain-wizard.sh
```

O wizard cobre DNS/TLS/OAuth/env (overlap). O ticket 3 (tirar URI/onrender velhos) está fechado — ver checklist abaixo. Não reabras overlap no Console nem um segundo webhook onrender.

## DNS / TLS

1. Render → `prospectly-api` → Settings → Custom Domains → `api.prospectlyonboard.com`.
2. Namecheap → Advanced DNS → CNAME `api` → `prospectly-api.onrender.com` (alvo da Render; o host público é o CNAME).
3. Probe:

```bash
curl -i https://api.prospectlyonboard.com/health/ready
curl -i https://prospectly-api.onrender.com/health/ready
# esperado: 200 no host novo; 404 + x-render-routing: blocked-render-subdomain no onrender
```

## Cookie (SEC-001)

`onrender.com` é public suffix: `*.onrender.com` **não** são same-site entre si.

Produção actual: browser fala com `app.prospectlyonboard.com` **e** `api.prospectlyonboard.com` → same-site / cross-origin → `REFRESH_COOKIE_SAME_SITE=lax` + `Secure`, cookie **host-only**.

Não voltes a `none` sem motivo. Não ponhas `Domain=.onrender.com`. Não reponhas `VITE_API_URL` no host onrender (está 404).

Deploy API + web juntos se mudares cookie ou `VITE_API_URL`.

## Env público (colar no Dashboard, não nesta doc)

| Variável | Serviço | Valor alvo |
| --- | --- | --- |
| `FRONTEND_URL` | api | `https://app.prospectlyonboard.com` |
| `CORS_ORIGINS` | api | `https://app.prospectlyonboard.com,https://prospectlyonboard.com,https://www.prospectlyonboard.com` (sem `*`) |
| `GOOGLE_OAUTH_REDIRECT_URI` | api (+ worker se existir) | `https://api.prospectlyonboard.com/api/v1/google-connections/callback` |
| `REFRESH_COOKIE_SAME_SITE` | api | `lax` |
| `VITE_API_URL` | web (rebuild) | `https://api.prospectlyonboard.com/api/v1` |
| `NEXT_PUBLIC_API_URL` | landing (rebuild) | o mesmo |

`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: tira newline no fim depois de colar no Render (`invalid_client`). O boot da API já faz `.trim()` nestes valores.

Google Cloud Console: **um** redirect URI — o host canónico. Origens JS: `https://app.prospectlyonboard.com` (+ localhost / web onrender se ainda servirem o app). Sem `*`.

## Webhook Asaas (sandbox)

URL: `https://api.prospectlyonboard.com/api/v1/billing/webhook/asaas`.

Um webhook. Mesmo `ASAAS_WEBHOOK_TOKEN`. Não uses `api.asaas.com`. Não recrie URL onrender — o host velho é 404.

## Probe Playwright

O spec `apps/web/e2e/api-custom-domain.probe.spec.ts` faz skip se o CNAME não resolver:

```bash
pnpm --filter @prospectly/web exec playwright test --config playwright.probe.config.ts
```

Health 200, `Access-Control-Allow-Origin: https://app.prospectlyonboard.com`, credentials true. Login cookie e callback OAuth continuam manuais (`invalid_grant` ≠ `invalid_client`).

## Ticket 3 — overlap fechado

1. Google Console: remover `https://prospectly-api.onrender.com/api/v1/google-connections/callback`. Não apagar origem JS `http://localhost:5173` nem a do app.
2. Asaas sandbox: apagar webhook cuja URL era o host onrender. Fica só o webhook do host novo.
3. Render → `prospectly-api` → Settings → Custom Domains → **Render Subdomain** → Disabled (sudo no Dashboard). Só a API. Web onrender fica.
4. Verificar: onrender 404; host novo 200; bundle do app só `https://api.prospectlyonboard.com/api/v1`.

## Tickets

1. Wizard DNS/TLS/OAuth/env — feito.
2. Cliente a falar só com o host novo — feito.
3. Overlap: URI/onrender velhos fora — feito.

## Fora de escopo

Ligar `api.asaas.com`, Microsoft/MCP, mudar o domínio do app, feature flags por org.

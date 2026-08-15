# Deploy Prospectly on Render

Blueprint: [`render.yaml`](../../render.yaml) (project **prospectly** / env **production**, region **frankfurt**).

Checklist do que ainda falta configurar (envs + webhooks): [`docs/superpowers/specs/2026-07-25-go-live-env-config-spec.md`](../superpowers/specs/2026-07-25-go-live-env-config-spec.md).

## What gets created

| Resource | Name | Role |
|----------|------|------|
| Postgres 16 | `prospectly-db` | Primary database (`basic-256mb`) |
| Key Value | `prospectly-redis` | BullMQ + readiness (`noeviction`, private) |
| Web (Docker) | `prospectly-api` | Nest API + queue producers (HTTP) |
| Worker (proposed) | `prospectly-worker` | BullMQ processors — see [workers.md](./workers.md) (approval required) |
| Static | `prospectly-web` | Vite SPA |
| Web (Node) | `prospectly-landing` | Next.js marketing site (substitui o antigo `prospectly-mvp`) |

**Build tip:** never use `corepack enable` on Render — the image FS is read-only (`EROFS` on `/usr/bin/pnpm`). Use plain `pnpm` (preinstalled) + `--config.production=false` so TypeScript/Vite/Tailwind (devDependencies) are installed.

**Static Site `prospectly-web`:** the official Render schema does **not** allow `region` on `runtime: static`. Region remains on API, landing, Postgres and Key Value. Validate locally with `node scripts/validate-render-blueprint.mjs` (schema: https://render.com/schema/render.yaml.json).

## Landing (substitui `prospectly-mvp`)

Serviço ativo criado via plugin (free / frankfurt):

| Campo | Valor |
|-------|-------|
| Nome | `prospectly` |
| URL Render | https://prospectly-d34m.onrender.com |
| Domínio | https://prospectlyonboard.com (Namecheap) |
| Dashboard | https://dashboard.render.com/web/srv-d9ql5njm8hqs738m8bu0 |
| Build | `pnpm install --frozen-lockfile --filter @prospectly/landing... --config.production=false && pnpm --filter @prospectly/landing run build` |
| Start | `pnpm --filter @prospectly/landing start` |
| Env | `NEXT_PUBLIC_LANDING_URL=https://prospectlyonboard.com` |

Serviços legado a apagar no Dashboard (duplicados / quebrados): `prospectly-mvp` (suspenso), `prospectly-landing` (corepack EROFS), `prospectly-lp`, `prospectly-site`.

Após ter URL da API/app reais, setar `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `WAITLIST_API_URL` e redesploy (build-time para `NEXT_PUBLIC_*`).

### Domínio Namecheap → Render

Plugin Render **não** cria custom domains — fazer no Dashboard + DNS:

1. [Dashboard do serviço](https://dashboard.render.com/web/srv-d9ql5njm8hqs738m8bu0) → **Settings** → **Custom Domains** → add:
   - `prospectlyonboard.com`
   - `www.prospectlyonboard.com`
2. Namecheap → **Domain List** → **Manage** `prospectlyonboard.com` → **Advanced DNS**:
   - Remover `AAAA` (Render não usa IPv6), A/`CNAME`/Redirect antigos de `@` e `www`.
   - Adicionar:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | `@` | `216.24.57.1` | 1 min (depois Automatic) |
| CNAME | `www` | `prospectly-d34m.onrender.com` | 1 min |

3. Voltar ao Render e esperar verificação + HTTPS automático.
4. Docs oficiais: [Namecheap DNS](https://render.com/docs/configure-namecheap-dns).

API health check: `GET /health/ready` (Postgres + Redis).

## First-time setup

1. Push this repo to GitHub (Blueprint sync requires a connected Git host).
2. In [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint** → select the repo → apply `render.yaml`.
3. When prompted, fill every `sync: false` secret (Stripe, Abacate, SMTP, public URLs, etc.).
4. After services have public URLs, set cross-links:

| Variable | Service | Example |
|----------|---------|---------|
| `FRONTEND_URL` | api | `https://<web-real>` (confirm in Dashboard — do not assume `*.onrender.com`) |
| `CORS_ORIGINS` | api | `https://<web-real>,https://prospectlyonboard.com` |
| `VITE_API_URL` | web (rebuild) | `https://<api-real>/api/v1` |
| `VITE_LANDING_URL` | web (rebuild) | `https://prospectlyonboard.com` |
| `VITE_GOOGLE_CLIENT_ID` | web (rebuild) | same value as `GOOGLE_CLIENT_ID` |
| `VITE_SENTRY_DSN` | web (rebuild, optional) | public DSN of the web Sentry project |
| `NEXT_PUBLIC_APP_URL` | landing (rebuild) | same as web |
| `NEXT_PUBLIC_LANDING_URL` | landing | `https://prospectlyonboard.com` |
| `NEXT_PUBLIC_API_URL` | landing | same as `VITE_API_URL` |
| `STRIPE_*_URL` / `ABACATE_*_URL` | api | billing success/cancel on web |

5. Redeploy **web** and **landing** after setting `VITE_*` / `NEXT_PUBLIC_*` (build-time). `build:deploy` fails if `VITE_API_URL`, `VITE_LANDING_URL` or `VITE_GOOGLE_CLIENT_ID` are missing, empty, HTTP, localhost or not HTTPS.
6. Google Sign-In: set `GOOGLE_CLIENT_ID` (API) and `VITE_GOOGLE_CLIENT_ID` (web, same value). In Google Cloud Console, add authorized JavaScript origins for the **confirmed** web URL only — do not add localhost to production.
7. Point Stripe webhook to `https://<api>/api/v1/billing/webhook/stripe`.
8. Point Abacate webhook to `https://<api>/api/v1/billing/webhook/abacate` with header `X-Abacate-Webhook-Secret: <ABACATE_WEBHOOK_SECRET>` (query `?webhookSecret=` still accepted for one release).
9. If the release includes schema changes, run the **single** migrate job/step before the API rolls — see [`migrations.md`](./migrations.md). The API image does **not** run migrate on start (`CMD` is `node dist/main.js` only).
10. If the API uses a custom domain (not `*.onrender.com`), add that origin to the web CSP `connect-src` in `render.yaml` and redeploy the Static Site.

## Local Dockerfiles (optional)

- API: `apps/api/Dockerfile` (used by Blueprint)
- Web: `apps/web/Dockerfile` + `apps/web/nginx.conf` (local/container only)
- Compose: `docker compose up` for local Postgres/Redis

The Render service `prospectly-web` uses **`runtime: static`**, not nginx. Cache, CSP and security headers for production live in `render.yaml`:

| Path | Header | Value |
|------|--------|--------|
| `/assets/*` | Cache-Control | `public, max-age=31536000, immutable` |
| `/index.html` | Cache-Control | `public, max-age=0, must-revalidate` |
| `/*` | CSP / HSTS / COOP / etc. | see Blueprint |

`nginx.conf` is kept semantically aligned for local Docker previews. Do not assume nginx runs on Render.

## Web build (Render)

```bash
pnpm install --frozen-lockfile --filter @prospectly/web... --config.production=false
pnpm --filter @prospectly/shared-types build
pnpm --filter @prospectly/web build:deploy
```

`@prospectly/shared-types` exports only `dist/` (not versioned). Skipping that compile fails typecheck with `TS2307`. Local `pnpm --filter @prospectly/web build` still works after shared-types is built and does **not** require production `VITE_*` values.

CI job `web-deploy-build` repeats this sequence on a clean checkout and runs `apps/web/scripts/assert-deploy-bundle.mjs`. That gate rejects baked development URLs (`http://localhost:3000`, `:3001`, `:5173`, loopback, `.invalid`). It does **not** fail on vendor sentinels such as React Router's `http://localhost` origin fallback or Sentry's sidecar default.

## Ops notes

- **JWT secrets** are `generateValue` on first create; rotate via Dashboard if needed. Production/staging refuse `change-me-*` placeholders.
- **Redis** must stay `noeviction` for BullMQ (also used for distributed rate limiting).
- **Free web spin-down** does not apply to `starter` plans used here; free Postgres expiry still matters if you downgrade DB plan.
- Custom domains: attach in Dashboard, then update CORS / frontend URLs / webhook endpoints.
- `autoDeployTrigger: checksPass` waits for GitHub CI on `main`.
- **SEC-001:** deploy API + web together (refresh cookie + `withCredentials`). Do not ship one without the other.
- **SEC-017:** configure SMTP so verification emails leave the no-op queue; critical mutations require `emailVerifiedAt`.

## Post-deploy checklist

Status: **OPEN** until the Dashboard URLs, secrets and smoke below are actually executed. Local CI passing is not go-live.

Hostnames such as `https://prospectly-web.onrender.com` and `https://prospectly-api.onrender.com/health/ready` returned 404 during the last audit — **confirm the live URLs in the Render Dashboard** before wiring CORS, Google origins or DNS.

Landing confirmed: https://prospectlyonboard.com

### Dashboard (manual)

- [ ] Blueprint linked to this repo, branch `main`, Auto Sync on, `checksPass`
- [ ] Public URL of `prospectly-web` copied from Dashboard
- [ ] Public URL of `prospectly-api` copied from Dashboard (`GET /health/ready`)
- [ ] No duplicate/legacy web or API services
- [ ] Custom domain + TLS (if used)
- [ ] `VITE_API_URL=https://<api-real>/api/v1`
- [ ] `VITE_LANDING_URL=https://prospectlyonboard.com`
- [ ] `VITE_GOOGLE_CLIENT_ID` (same as API `GOOGLE_CLIENT_ID`)
- [ ] `VITE_SENTRY_DSN` (optional; rebuild required)
- [ ] API `FRONTEND_URL` + `CORS_ORIGINS` include the real web origin
- [ ] Google Cloud authorized JavaScript origin = real web URL (no localhost in production)
- [ ] Rebuild Static Site after every `VITE_*` change

### Smoke staging (real API — do not commit credentials)

Run against the published origin after infra is configured (`STAGING_BASE_URL=https://<web-real>`):

- [ ] Open `/login`
- [ ] Open a protected route directly → redirect to login
- [ ] Register a test user
- [ ] Login
- [ ] Reload restores session (refresh cookie + `withCredentials`)
- [ ] Logout
- [ ] Request password reset and confirm real delivery
- [ ] Confirm email
- [ ] Open dashboard and perform one authenticated read
- [ ] Deep-link lead / campaign / opportunity
- [ ] Google OAuth with authorized origin
- [ ] Stripe test mode + `/billing/success` and `/billing/cancel`
- [ ] Abacate/PIX in a safe environment + `/billing/pix`
- [ ] Controlled error appears in Sentry (no tokens/PII)
- [ ] No CSP or CORS errors in the console
- [ ] Response headers: CSP, HSTS, COOP, `X-Content-Type-Options`
- [ ] `/assets/*` has immutable cache; `index.html` does not
- [ ] Desktop and mobile

Playwright smoke file: `apps/web/e2e/staging-smoke.spec.ts` (ignored unless `STAGING_BASE_URL` is set).

## Out of scope here

OSM self-host, automated DB backups (configure in Render Dashboard / snapshots), magic-link invites, access JWT in cookie (spike Option C).

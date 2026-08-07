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

**Build tip:** never use `corepack enable` on Render Node builds — the image FS is read-only (`EROFS` on `/usr/bin/pnpm`). Use plain `pnpm` (preinstalled) + `--config.production=false` so Next gets TypeScript/Tailwind from devDependencies.

## Landing (substitui `prospectly-mvp`)

Serviço ativo criado via plugin (free / frankfurt):

| Campo | Valor |
|-------|-------|
| Nome | `prospectly` |
| URL | https://prospectly-d34m.onrender.com |
| Dashboard | https://dashboard.render.com/web/srv-d9ql5njm8hqs738m8bu0 |
| Build | `pnpm install --frozen-lockfile --filter @prospectly/landing... --config.production=false && pnpm --filter @prospectly/landing run build` |
| Start | `pnpm --filter @prospectly/landing start` |

Serviços legado a apagar no Dashboard (duplicados / quebrados): `prospectly-mvp` (suspenso), `prospectly-landing` (corepack EROFS), `prospectly-lp`, `prospectly-site`.

Após ter URL da API/app reais, setar `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `WAITLIST_API_URL` e redesploy (build-time para `NEXT_PUBLIC_*`).

API health check: `GET /health/ready` (Postgres + Redis).

## First-time setup

1. Push this repo to GitHub (Blueprint sync requires a connected Git host).
2. In [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint** → select the repo → apply `render.yaml`.
3. When prompted, fill every `sync: false` secret (Stripe, Abacate, SMTP, public URLs, etc.).
4. After services have public URLs, set cross-links:

| Variable | Service | Example |
|----------|---------|---------|
| `FRONTEND_URL` | api | `https://prospectly-web.onrender.com` |
| `CORS_ORIGINS` | api | `https://prospectly-web.onrender.com,https://prospectly-landing.onrender.com` |
| `VITE_API_URL` | web (rebuild) | `https://prospectly-api.onrender.com/api/v1` |
| `VITE_LANDING_URL` | web (rebuild) | `https://prospectly-landing.onrender.com` |
| `NEXT_PUBLIC_APP_URL` | landing (rebuild) | same as web |
| `NEXT_PUBLIC_LANDING_URL` | landing | its own URL |
| `NEXT_PUBLIC_API_URL` | landing | same as `VITE_API_URL` |
| `STRIPE_*_URL` / `ABACATE_*_URL` | api | billing success/cancel on web |

5. Redeploy **web** and **landing** after setting `VITE_*` / `NEXT_PUBLIC_*` (build-time).
6. Google Sign-In: set `GOOGLE_CLIENT_ID` (API) and `VITE_GOOGLE_CLIENT_ID` (web, same value). In Google Cloud Console, add authorized JavaScript origins for the web URL and authorized redirect URIs if using GIS.
7. Point Stripe webhook to `https://<api>/api/v1/billing/webhook/stripe`.
8. Point Abacate webhook to `https://<api>/api/v1/billing/webhook/abacate` with header `X-Abacate-Webhook-Secret: <ABACATE_WEBHOOK_SECRET>` (query `?webhookSecret=` still accepted for one release).
9. If the release includes schema changes, run the **single** migrate job/step before the API rolls — see [`migrations.md`](./migrations.md). The API image does **not** run migrate on start (`CMD` is `node dist/main.js` only).

## Local Dockerfiles (optional)

- API: `apps/api/Dockerfile` (used by Blueprint)
- Web: `apps/web/Dockerfile` (nginx; Blueprint uses **static** runtime instead)
- Compose: `docker compose up` for local Postgres/Redis

## Ops notes

- **JWT secrets** are `generateValue` on first create; rotate via Dashboard if needed. Production/staging refuse `change-me-*` placeholders.
- **Redis** must stay `noeviction` for BullMQ (also used for distributed rate limiting).
- **Free web spin-down** does not apply to `starter` plans used here; free Postgres expiry still matters if you downgrade DB plan.
- Custom domains: attach in Dashboard, then update CORS / frontend URLs / webhook endpoints.
- `autoDeployTrigger: checksPass` waits for GitHub CI on `main`.
- **SEC-001:** deploy API + web together (refresh cookie + `withCredentials`). Do not ship one without the other.
- **SEC-017:** configure SMTP so verification emails leave the no-op queue; critical mutations require `emailVerifiedAt`.

## Post-deploy checklist

- [ ] `GET https://<api>/health/ready` → ready (no DB/Redis details in public body)
- [ ] Register + login on web (refresh cookie HttpOnly; access only in memory)
- [ ] F5 restores session via cookie refresh; logout clears cookie
- [ ] Unverified email: banner shown; checkout/invite return 403 `EMAIL_NOT_VERIFIED`
- [ ] Landing CTAs open app with correct plan/currency query
- [ ] Stripe EUR checkout (test then live)
- [ ] Abacate BRL lifetime PIX + monthly CARD (see `docs/billing/dual-gateways.md`)
- [ ] Verification + forgot-password e-mail once SMTP is wired
- [ ] Seed never run in production (`prisma/seed.ts` throws)

## Out of scope here

Sentry SDK wiring, OSM self-host, automated DB backups (configure in Render Dashboard / snapshots), magic-link invites, access JWT in cookie (spike Option C).

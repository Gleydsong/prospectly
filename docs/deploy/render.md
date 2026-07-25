# Deploy Prospectly on Render

Blueprint: [`render.yaml`](../../render.yaml) (project **prospectly** / env **production**, region **frankfurt**).

## What gets created

| Resource | Name | Role |
|----------|------|------|
| Postgres 16 | `prospectly-db` | Primary database (`basic-256mb`) |
| Key Value | `prospectly-redis` | BullMQ + readiness (`noeviction`, private) |
| Web (Docker) | `prospectly-api` | Nest API + in-process workers |
| Static | `prospectly-web` | Vite SPA |
| Web (Node) | `prospectly-landing` | Next.js marketing site |

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
6. Point Stripe webhook to `https://<api>/api/v1/billing/webhook/stripe`.
7. Point Abacate webhook to `https://<api>/api/v1/billing/webhook/abacate?webhookSecret=<ABACATE_WEBHOOK_SECRET>`.
8. Confirm migrate ran on API boot (`prisma migrate deploy` in Docker `CMD`).

## Local Dockerfiles (optional)

- API: `apps/api/Dockerfile` (used by Blueprint)
- Web: `apps/web/Dockerfile` (nginx; Blueprint uses **static** runtime instead)
- Compose: `docker compose up` for local Postgres/Redis

## Ops notes

- **JWT secrets** are `generateValue` on first create; rotate via Dashboard if needed.
- **Redis** must stay `noeviction` for BullMQ.
- **Free web spin-down** does not apply to `starter` plans used here; free Postgres expiry still matters if you downgrade DB plan.
- Custom domains: attach in Dashboard, then update CORS / frontend URLs / webhook endpoints.
- `autoDeployTrigger: checksPass` waits for GitHub CI on `main`.

## Post-deploy checklist

- [ ] `GET https://<api>/health/ready` → ready
- [ ] Register + login on web
- [ ] Landing CTAs open app with correct plan/currency query
- [ ] Stripe EUR checkout (test then live)
- [ ] Abacate BRL lifetime PIX + monthly CARD (see `docs/billing/dual-gateways.md`)
- [ ] Forgot-password e-mail once SMTP is wired

## Out of scope here

SEC-001 cookies, Sentry SDK wiring, OSM self-host, automated DB backups (configure in Render Dashboard / snapshots).

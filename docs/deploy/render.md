# Deploy do Prospectly na Render

Blueprint: [`render.yaml`](../../render.yaml) (projeto **prospectly** / env **production**, região **frankfurt**).

Checklist do que ainda falta configurar (envs + webhooks): [`docs/superpowers/specs/2026-07-25-go-live-env-config-spec.md`](../superpowers/specs/2026-07-25-go-live-env-config-spec.md). Canônico de billing: [`docs/billing/payments.md`](../billing/payments.md).

## O que é criado

| Recurso | Nome | Papel |
| ----------------- | -------------------- | ---------------------------------------------------------------------- |
| Postgres 16 | `prospectly-db` | Banco primário (`basic-256mb`) |
| Key Value | `prospectly-redis` | BullMQ + readiness (`noeviction`, privado) |
| Web (Docker) | `prospectly-api` | API Nest + produtores de fila (HTTP) |
| Worker (proposto) | `prospectly-worker` | Processors BullMQ — ver [workers.md](./workers.md) (aprovação obrigatória) |
| Static | `prospectly-web` | SPA Vite |
| Web (Node) | `prospectly-landing` | Site de marketing Next.js (substitui o antigo `prospectly-mvp`) |

**Dica de build:** nunca use `corepack enable` nos builds Node da Render — o FS da imagem é somente leitura (`EROFS` em `/usr/bin/pnpm`). Use `pnpm` puro (já pré-instalado) + `--config.production=false` para Vite/Next terem TypeScript nas devDependencies. O `.npmrc` da raiz também define `production=false` para o install estático de `prospectly-web` continuar funcionando mesmo se o comando de build no Dashboard omitir a flag.

O app Vite usa React Router. Mantenha o rewrite do Static Site declarado no Blueprint (`/*` → `/index.html`, ação `Rewrite`) e confirme que ele aparece em **Redirects/Rewrites** depois de cada sync inicial ou import de serviço. A Render **não** consome arquivos `_redirects` estilo Netlify; sem a regra no serviço, acesso direto e F5 em `/login`, `/register` e qualquer outra rota de cliente devolvem `404`.

## Landing (substitui `prospectly-mvp`)

Serviço ativo criado via plugin (free / frankfurt):

| Campo | Valor |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Nome | `prospectly` |
| URL Render | https://prospectly-d34m.onrender.com |
| Domínio | https://prospectlyonboard.com (Namecheap) |
| Dashboard | https://dashboard.render.com/web/srv-d9ql5njm8hqs738m8bu0 |
| Build | `pnpm install --frozen-lockfile --filter @prospectly/landing... --config.production=false && pnpm --filter @prospectly/landing run build` |
| Start | `pnpm --filter @prospectly/landing start` |
| Env | `NEXT_PUBLIC_LANDING_URL=https://prospectlyonboard.com` |

Serviços legado a apagar no Dashboard (duplicados / quebrados): `prospectly-mvp` (suspenso), `prospectly-landing` (corepack EROFS), `prospectly-lp`, `prospectly-site`.

Depois de ter as URLs reais da API/app, defina `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `WAITLIST_API_URL` e faça redesploy (`NEXT_PUBLIC_*` é build-time).

### Domínio Namecheap → Render

O plugin da Render **não** cria custom domains — faça no Dashboard + DNS:

1. [Dashboard do serviço](https://dashboard.render.com/web/srv-d9ql5njm8hqs738m8bu0) → **Settings** → **Custom Domains** → add:
   - `prospectlyonboard.com`
   - `www.prospectlyonboard.com`
2. Namecheap → **Domain List** → **Manage** `prospectlyonboard.com` → **Advanced DNS**:
   - Remover `AAAA` (Render não usa IPv6), A/`CNAME`/Redirect antigos de `@` e `www`.
   - Adicionar:

| Tipo | Host | Valor | TTL |
| ----- | ----- | ------------------------------ | ------------------------ |
| A | `@` | `216.24.57.1` | 1 min (depois Automatic) |
| CNAME | `www` | `prospectly-d34m.onrender.com` | 1 min |

3. Voltar ao Render e esperar verificação + HTTPS automático.
4. Docs oficiais: [Namecheap DNS](https://render.com/docs/configure-namecheap-dns).

Health check da API: `GET /health/ready` (Postgres + Redis).

## Setup inicial

1. Faça push deste repo no GitHub (o sync de Blueprint exige git host conectado).
2. No [Dashboard da Render](https://dashboard.render.com/) → **New** → **Blueprint** → selecione o repo → aplique `render.yaml`.
3. Quando pedido, preencha todo secret `sync: false` (Asaas, AbacatePay histórico, SMTP, URLs públicas etc.).
4. Depois que os serviços tiverem URLs públicas, ligue os cruzamentos:

| Variável | Serviço | Exemplo |
| ------------------------- | ----------------- | ----------------------------------------------------------------------------- |
| `FRONTEND_URL` | api | `https://prospectly-web.onrender.com` |
| `CORS_ORIGINS` | api | `https://prospectly-web.onrender.com,https://prospectly-landing.onrender.com` |
| `VITE_API_URL` | web (rebuild) | `https://prospectly-api.onrender.com/api/v1` |
| `VITE_LANDING_URL` | web (rebuild) | `https://prospectly-landing.onrender.com` |
| `NEXT_PUBLIC_APP_URL` | landing (rebuild) | a mesma da web |
| `NEXT_PUBLIC_LANDING_URL` | landing | a URL dela mesma |
| `NEXT_PUBLIC_API_URL` | landing | a mesma de `VITE_API_URL` |
| `ABACATE_*_URL` | api | success/cancel de billing na web |
| `PIX_PROVIDER` | api | `ASAAS` depois do cutover autorizado; rollback é `ABACATE` |
| `ASAAS_ENABLED` | api | `true` com secrets Asaas de Sandbox/produção; chaves vazias recusam boot |

5. Faça redesploy de **web** e **landing** depois de setar `VITE_*` / `NEXT_PUBLIC_*` (build-time).
6. Google Sign-In: defina `GOOGLE_CLIENT_ID` (API) e `VITE_GOOGLE_CLIENT_ID` (web, mesmo valor). No Google Cloud Console, adicione JavaScript origins autorizadas para a URL da web e redirect URIs autorizadas se usar GIS.
7. Mantenha o webhook histórico do AbacatePay em `https://<api>/api/v1/billing/webhook/abacate` com header `X-Abacate-Webhook-Secret: <ABACATE_WEBHOOK_SECRET>`. Secrets na query string **não** são aceitos. Aponte o webhook Asaas para `https://<api>/api/v1/billing/webhook/asaas` com o mesmo token dedicado guardado em `ASAAS_WEBHOOK_TOKEN` e enviado em `asaas-access-token`.
8. Se o release incluir mudança de schema, rode o job/passo de migrate **único** antes de rolar a API — ver [`migrations.md`](./migrations.md). A imagem da API **não** roda migrate no start (`CMD` é só `node dist/main.js`).

## Dockerfiles locais (opcional)

- API: `apps/api/Dockerfile` (usado pelo Blueprint)
- Web: `apps/web/Dockerfile` (nginx; o Blueprint usa runtime **static**)
- Compose: `docker compose up` para Postgres/Redis locais

## Notas de ops

- **Secrets JWT** usam `generateValue` na primeira criação; rotacione pelo Dashboard se preciso. Production/staging recusam placeholders `change-me-*`.
- **Métricas de ops:** defina `OPS_METRICS_TOKEN` (≥ 32 chars) no serviço da API e chame `GET /api/v1/ops/metrics` com `X-Prospectly-Ops-Token`. Papéis JWT de tenant não leem telemetria da instância. Token ausente → 404.
- **Redis** deve permanecer `noeviction` para BullMQ (também usado no rate limiting distribuído).
- **Spin-down de web free** não se aplica aos planos `starter` usados aqui; expiração de Postgres free ainda importa se você rebaixar o plano do DB.
- Custom domains: anexe no Dashboard e depois atualize CORS / URLs de frontend / endpoints de webhook.
- `autoDeployTrigger: checksPass` espera o CI do GitHub em `main`.
- **SEC-001:** faça deploy de API + web juntos (cookie de refresh + `withCredentials`). Não entregue um sem o outro.
- **Cookie de refresh:** `onrender.com` é public suffix, então `prospectly-web.onrender.com` e `prospectly-api.onrender.com` são sites diferentes. Produção portanto usa `REFRESH_COOKIE_SAME_SITE=none` com `Secure` e mantém CSRF via `X-Requested-With`. O conserto estrutural é um par same-site como `app.prospectly.com` + `api.prospectly.com`, que pode voltar para `lax`. Não defina `Domain=.onrender.com`.
- **SEC-017:** configure SMTP para e-mails de verificação saírem da fila no-op; mutações críticas exigem `emailVerifiedAt`.

## Checklist pós-deploy

- [ ] `GET https://<api>/health/ready` → ready (sem detalhes de DB/Redis no body público)
- [ ] Cadastro + login na web (refresh cookie HttpOnly; access só em memória)
- [ ] F5 restaura a sessão via refresh do cookie; logout limpa o cookie
- [ ] E-mail não verificado: banner visível; checkout/convite devolvem 403 `EMAIL_NOT_VERIFIED`
- [ ] CTAs da landing abrem o app com query correta de plano/moeda
- [ ] PIX BRL Asaas: pacotes de crédito e mensal ilimitado, com webhook autenticado e recibo autoritativo (ver `docs/billing/payments.md`)
- [ ] Webhook histórico AbacatePay ainda aceita e reconcilia registros existentes
- [ ] E-mail de verificação + esqueci senha depois do SMTP ligado
- [ ] Seed nunca roda em produção (`prisma/seed.ts` lança)

## Fora de escopo aqui

Wiring do SDK Sentry, OSM self-host, backups automáticos de DB (configure no Dashboard / snapshots da Render), convites magic-link, access JWT em cookie (spike Opção C).

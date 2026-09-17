# Prospectly MCP OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). There is a QA agent in this worktree reviewing and testing. **Do not git commit or open a PR** until local tests pass and the human asks.

**Goal:** Authorization Server OAuth 2.1 + Servidor MCP no Nest da API, com Ligação MCP (OWNER/ADMIN, uma org) e as mesmas leituras da API de plugin.

**Architecture:** Mesmo processo Nest. `/mcp` Streamable HTTP com Bearer OAuth. Consentimento no web. PluginToken intacto. Tools chamam `PluginAccessService.extract()`.

**Tech Stack:** NestJS 10, Prisma 6, Jest, Vitest, `@modelcontextprotocol/sdk`, OAuth 2.1 + PKCE S256 + DCR.

**Spec:** `docs/superpowers/specs/2026-09-16-prospectly-mcp-oauth-design.md`  
**ADR:** `docs/adr/0017-mcp-oauth-alongside-plugin-token.md`

## Global Constraints

- Sem `git commit` / `git push` / `gh pr` neste ciclo.
- Superfície v1: `summary` / `leads` (sem PII de contacto) / `searches`. Só leitura.
- JWT da app e `pst_…` não autenticam `/mcp`.
- PluginToken + `GET /integrations/plugin/v1/data` não mudam de comportamento.
- Conexão Google e Sign-In GIS fora.
- Cookie refresh continua só em `/api/v1/auth`.
- Branch: `feat/mcp-oauth`. Worktree: `/Users/guidev/orca/workspaces/prospectly/mcp_prospectly`.
- Código/testes em inglês; copy de UI via i18n pt+en.

---

### Task 1: Protocol helpers (redirect, PKCE, hash)

**Files:**
- Create: `apps/api/src/modules/oauth/oauth-protocol.ts`
- Test: `apps/api/src/modules/oauth/oauth-protocol.spec.ts`

**Interfaces:**
- Produces:
  - `hashOpaque(value: string): string` — SHA-256 hex (igual PluginToken)
  - `isAllowedRedirectUri(uri: string): boolean` — `https:` ou loopback `http://127.0.0.1|localhost|[::1]` com porta
  - `verifyPkceS256(verifier: string, challenge: string): boolean`
  - `MCP_SCOPE = 'prospectly.plugin.read'`
  - `buildWwwAuthenticate(resourceMetadataUrl: string): string`

- [ ] **Step 1:** Teste RED em `oauth-protocol.spec.ts`:
  - `https://cursor.example/cb` allowed
  - `http://127.0.0.1:10000/callback` allowed
  - `http://localhost:3000/cb` allowed
  - `http://evil.example/cb` rejected
  - `javascript:alert(1)` rejected
  - PKCE: verifier conhecido → challenge S256 base64url (sem padding) verifica true; verifier errado false
  - `hashOpaque('pst_x')` é hex 64 chars e ≠ plaintext
  - `buildWwwAuthenticate('https://api.example/.well-known/oauth-protected-resource')` contém `Bearer` e `resource_metadata=`

- [ ] **Step 2:** `pnpm --filter @prospectly/api test -- src/modules/oauth/oauth-protocol.spec.ts` — FAIL (módulo ausente).

- [ ] **Step 3:** Implementar funções puras em `oauth-protocol.ts`.

- [ ] **Step 4:** Re-correr o teste — PASS.

---

### Task 2: Prisma Ligação MCP + OAuth tables + RLS

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (User, Organization relations + 5 models)
- Create: `apps/api/prisma/migrations/20260916233000_mcp_oauth/migration.sql`
- Modify: `apps/api/src/common/prisma/tenant-guard.ts`
- Modify: `apps/api/src/common/prisma/tenant-guard.spec.ts`
- Modify: `apps/api/.env.example` — `MCP_RESOURCE_URL=http://127.0.0.1:3000/mcp`

**Models:**
- `OauthClient` GLOBAL: `id` (client_id), `clientName`, `redirectUris Json`, `tokenEndpointAuthMethod` default `none`, `createdAt`, `lastUsedAt`
- `McpConnection` TENANT: `organizationId`, `userId`, `clientId`, `clientName`, `scope`, `revokedAt`, `lastUsedAt`; index `(organizationId, revokedAt)`
- `OauthAuthorizationCode` TENANT: hashes, `clientId`, `userId`, `organizationId`, `redirectUri`, `codeChallenge`, `resource`, `scope`, `expiresAt`, `usedAt`
- `OauthAccessToken` TENANT: `tokenHash` unique, `clientId`, `userId`, `organizationId`, `connectionId`, `resource`, `scope`, `expiresAt`, `revokedAt`
- `OauthRefreshToken` TENANT: `tokenHash` unique, `accessTokenId`, `connectionId`, `expiresAt`, `revokedAt`, `replacedById`

Migration: GRANT `prospectly_app`; ENABLE+FORCE RLS; policy `prospectly_rls_bypass() OR organizationId = prospectly_current_org()` nas tabelas com `organizationId`. `OauthClient` sem org: GRANT + RLS com policy `prospectly_rls_bypass() OR true` **não**. OauthClient é catálogo global de clientes MCP — policy `USING (true)` só SELECT para app role, ou ENABLE RLS + policy using bypass OR true for the app role (DCR is public). Prefer: ENABLE RLS + `USING (true) WITH CHECK (true)` for OauthClient because it has no tenant (like WaitlistEntry / User). Check WaitlistEntry: GLOBAL, may still have RLS.

If Waitlist is GLOBAL without org RLS, OauthClient: GRANT all to prospectly_app; ENABLE RLS; policy USING (true) WITH CHECK (true) — DCR writes from public route with bypass anyway.

- [ ] **Step 1:** tenant-guard.spec: `McpConnection` injects organizationId like SavedReport. RED.

- [ ] **Step 2:** Add models + TENANT_MODELS `McpConnection`, `OauthAuthorizationCode`, `OauthAccessToken`, `OauthRefreshToken`; GLOBAL `OauthClient`.

- [ ] **Step 3:** `pnpm --filter @prospectly/api exec prisma generate`. Test tenant-guard PASS.

- [ ] **Step 4:** Hand-written SQL migration with RLS (não `migrate dev` interactivo se possível: ficheiro SQL + generate).

---

### Task 3: DCR `POST /api/v1/oauth/register`

**Files:**
- Create: `apps/api/src/modules/oauth/oauth.service.ts`
- Create: `apps/api/src/modules/oauth/oauth.service.spec.ts`
- Create: `apps/api/src/modules/oauth/oauth.controller.ts`
- Create: `apps/api/src/modules/oauth/oauth.module.ts`
- Create: `apps/api/src/modules/oauth/dto/register-client.dto.ts`
- Modify: `apps/api/src/app.module.ts` import OauthModule
- Throttle 5/min no register

**Produces:** `registerClient({ client_name, redirect_uris, token_endpoint_auth_method? })` → `{ client_id, client_name, redirect_uris, token_endpoint_auth_method: 'none', grant_types: ['authorization_code','refresh_token'] }`

- [ ] RED: redirect `http://evil.test/cb` → BadRequest `invalid_request`
- [ ] RED: `https://ok.example/cb` persiste OauthClient; response `client_id` uuid; DB só campos públicos
- [ ] GREEN implementação; Prisma mock como plugin-access.service.spec
- [ ] Controller `@Public()` `@Throttle({ default: { ttl: 60_000, limit: 5 } })`

---

### Task 4: Authorize 302 + consent OWNER/ADMIN + code

**Files:**
- Modify: oauth.service/controller/spec
- Config: `frontendUrl` já existe; `mcpResourceUrl` em `configuration.ts` (`MCP_RESOURCE_URL` default `http://127.0.0.1:3000/mcp`)

**Produces:**
- `GET /api/v1/oauth/authorize` `@Public()`: valida client, redirect_uri (exact match DCR), PKCE S256, `resource` === mcpResourceUrl, scope. 302 `FRONTEND_URL/oauth/consent?` + query original. redirect_uri inválido → 400 JSON **sem** 302 (open redirect).
- `POST /api/v1/oauth/consent` JWT app: body `{ client_id, redirect_uri, code_challenge, code_challenge_method, resource, scope, state, organizationId, decision: 'allow'|'deny' }`
  - deny → `{ redirect: `${redirect_uri}?error=access_denied&state=` }`
  - VIEWER / sem membership OWNER|ADMIN nessa org → 403
  - allow → cria `McpConnection`, authorization code 60s hashed, audit `integration.mcp_connection.granted`, `{ redirect: `${redirect_uri}?code=&state=` }`

- [ ] Tests unitários no service (Prisma mock): VIEWER 403; deny access_denied; allow code ≠ plaintext hash; resource mismatch `invalid_target`
- [ ] Authorize HTTP: pode ser unit “buildConsentRedirect(frontend, query)”

---

### Task 5: Token + refresh rotation + revoke Ligação MCP

**Files:** oauth.service/spec/controller; IntegrationsController list/revoke connections

**Produces:**
- `POST /api/v1/oauth/token` `@Public()` `@Throttle` 20/min. `application/x-www-form-urlencoded` ou JSON:
  - `grant_type=authorization_code` + code + code_verifier + redirect_uri + client_id → access 15m + refresh 30d. Code one-shot. PKCE fail / reused → `invalid_grant`
  - `grant_type=refresh_token` + refresh_token: rotate; reuse of revoked parent → revoke connection family `invalid_grant`
- Access/refresh plaintext prefix `mca_` / `mcr_` só na response; hashes SHA-256
- `POST /api/v1/oauth/revoke` Public with token; or authenticated revoke connection
- `GET /api/v1/integrations/mcp/connections` OWNER/ADMIN — lista ligações da org actual
- `DELETE /api/v1/integrations/mcp/connections/:id` — revokedAt + tokens; audit `.revoked`

- [ ] Tests: PKCE fail; code reuse; refresh reuse kills family; revoke then refresh invalid_grant; hashes ≠ plaintext; audience/resource stored as mcp URL

---

### Task 6: Well-known + prefix exclude + CORS split + `/mcp` 401

**Files:**
- Create: `apps/api/src/modules/mcp/mcp.controller.ts` (401 path first)
- Create: `apps/api/src/modules/oauth/oauth-metadata.controller.ts`
- Modify: `apps/api/src/main.ts` prefix exclude + CORS
- Test: `apps/api/src/modules/mcp/mcp.http.spec.ts` (Nest TestingModule + supertest) **ou** unit do controller + spec do prefix helper

**Produces:**
- `GET /.well-known/oauth-protected-resource` → `{ resource, authorization_servers, scopes_supported: ['prospectly.plugin.read'], bearer_methods_supported: ['header'] }`
- `GET /.well-known/oauth-authorization-server` → issuer, endpoints register/authorize/token/revoke, `code_challenge_methods_supported: ['S256']`, `grant_types_supported`
- `POST /mcp` sem Authorization → 401 + `WWW-Authenticate: Bearer realm="prospectly", resource_metadata="…"`
- JWT app e `pst_` também 401
- CORS `*` só `/mcp` e `/.well-known/*`; expose `WWW-Authenticate, Mcp-Session-Id, Mcp-Protocol-Version`

- [ ] Integration spec com `app.setGlobalPrefix` igual `main.ts`

---

### Task 7: MCP tools sobre extract

**Files:**
- Create: `apps/api/src/modules/mcp/mcp.module.ts`, `mcp.server.ts`
- Modify: mcp.controller to Streamable HTTP
- Add dep `@modelcontextprotocol/sdk` em `apps/api`
- mcp.server.spec.ts

**Produces:** tools `get_org_summary`, `list_leads`, `list_searches`. Resolve access by hash → connection not revoked → `runWithTenant` → `extract`. `limit` 1–100. `readOnlyHint`. Não seleccionar email/phone (confiar extract + teste de tool args).

- [ ] Valid Bearer chama extract da org do token
- [ ] limit 0 / 101 → erro invalid_params (Zod na tool)

---

### Task 8: Web consent + login returnUrl + persona skip

**Files:**
- Modify: `apps/web/src/components/protected-route.tsx` — `from: pathname + search`; skip persona redirect quando path `/oauth/consent`
- Modify: `apps/web/src/components/protected-route.test.tsx`
- Modify: `apps/web/src/pages/auth/login-page.tsx` if needed (já usa `state.from` + `resolveInternalRedirect`)
- Create: `apps/web/src/pages/oauth/oauth-consent-page.tsx` + test
- Create: `apps/web/src/features/oauth/api.ts`
- Modify: `apps/web/src/App.tsx` route `/oauth/consent` inside ProtectedRoute
- i18n `apps/web/src/i18n/locales/{pt,en}.json`

Consent: lê query OAuth; GET `/users/me` memberships filter OWNER/ADMIN; picker; POST `/oauth/consent`; `window.location.assign(redirect)` só se URL é redirect_uri da query (já validada no server). Recusar mesmo POST decision deny.

- [ ] Vitest: sem sessão → login (ProtectedRoute)
- [ ] picker só OWNER/ADMIN
- [ ] ProtectedRoute preserva query no `from`

---

### Task 9: Settings Ligações MCP

**Files:**
- Modify: `apps/web/src/features/integrations/api.ts` + card + test
- i18n: URL MCP `import.meta.env.VITE_API_URL` origin + `/mcp` **cuidado**: VITE_API_URL é `https://api…/api/v1`. Mostrar `new URL('/mcp', apiOrigin)` — origin host da API sem `/api/v1`.

- [ ] Card PluginToken permanece
- [ ] Lista ligações + revogar
- [ ] Mostra URL MCP

---

### Task 10: Redact + rate limit + verificação local

**Files:**
- `pino-redact-paths.ts` + spec: `req.body.code`, `req.body.code_verifier`, `req.body.refresh_token`, `req.body.access_token`
- Correr:
  - `pnpm --filter @prospectly/api test -- src/modules/oauth src/modules/mcp src/common/logging/pino-redact-paths.spec.ts src/common/prisma/tenant-guard.spec.ts src/modules/integrations`
  - `pnpm --filter @prospectly/web exec vitest run src/components/protected-route.test.tsx src/pages/oauth src/features/settings/integrations-settings-card.test.tsx`
  - `pnpm --filter @prospectly/api typecheck` e `pnpm --filter @prospectly/web typecheck` se o tempo permitir

**Não fazer:** commit, PR, migrate em produção, Playwright Cursor.

---

## Self-review vs spec

| Spec | Task |
|------|------|
| OAuth AS + DCR + PKCE | 1, 3, 4, 5 |
| Ligação MCP OWNER/ADMIN 1 org | 4, 5 |
| PluginToken permanece | 9 (não tocar extract) |
| `/mcp` tools extract | 6, 7 |
| Well-known + CORS split | 6 |
| Consent web + picker | 8 |
| Settings revoke | 9 |
| Testes Jest/Vitest | cada task + 10 |
| Sem WhatsApp/Google/billing write | fora |

Sem TBD. Nomes estáveis: `MCP_SCOPE`, `McpConnection`, tools `get_org_summary` / `list_leads` / `list_searches`.

# Design: MCP OAuth + API de plugin (v1)

**Data:** 2026-09-16  
**Status:** Aprovado em conversa (humano). Pronto para plano de implementação após review deste ficheiro.  
**Branch:** `feat/mcp-oauth`  
**Contexto:** Integrations  
**ADR:** `docs/adr/0017-mcp-oauth-alongside-plugin-token.md`

## Problem Statement

Agentes externos (Cursor, Claude, Codex) não conseguem consumir dados do Prospectly pelo protocolo MCP. A API de plugin (`GET /api/v1/integrations/plugin/v1/data` + PluginToken `pst_…`) já existe para editores/agentes, mas:

1. Não há handshake MCP (`/mcp`, tools, 401 + discovery OAuth).
2. A API só emite JWT da app (sessão web). Não é Authorization Server para terceiros.
3. Cookie de refresh vive só em `/api/v1/auth` — um `authorize` na API não reutiliza a sessão.

O cliente precisa de UX “login Prospectly → ceder ligação → o agente lê a org”.

## Decisions (alinhadas)

| # | Decisão |
|---|---------|
| Q1 | Consumidor = agente **externo** do cliente (não Copiloto in-app). |
| Q2 | OAuth MCP + Authorization Server próprio. |
| Q3 | Superfície = API de plugin: `summary`, `leads` sem PII de contacto, `searches`. Só leitura. |
| Q4 | Só **OWNER/ADMIN** autoriza. |
| Q5 | PluginToken **permanece** (HTTP/Notion/curl). MCP usa OAuth. Ambos chamam `PluginAccessService.extract()`. |
| Q6 | Ecrã de consentimento escolhe **uma** org. 1 ligação = 1 tenant. |

Invariantes que não se negociam neste v1:

- Sem disparo WhatsApp / `wa.me`.
- Sem Conexão Google no MCP.
- Sem billing write.
- JWT da app e `pst_…` **não** autenticam `/mcp`.
- Copiloto CRM (contexto Agents) **não** é Ligação MCP.

## Solution

Abordagem: **o mesmo processo Nest da API** é Resource Server MCP e Authorization Server OAuth 2.1. Consentimento no web (`https://app.prospectlyonboard.com`). Sem serviço Render extra. Sem pacote stdio no v1.

### Arquitectura

```text
Cursor/Claude
    │  POST /mcp sem Bearer → 401 + WWW-Authenticate
    ▼
API Nest
    GET  /.well-known/oauth-protected-resource     RFC 9728
    GET  /.well-known/oauth-authorization-server   RFC 8414
    POST /api/v1/oauth/register                    DCR
    GET  /api/v1/oauth/authorize                   302 → web /oauth/consent
    POST /api/v1/oauth/consent                     JWT da app, OWNER/ADMIN
    POST /api/v1/oauth/token                       code+PKCE → access+refresh
    POST /api/v1/oauth/revoke
    GET|POST /mcp                                  Bearer OAuth → tools
                │
                ▼
         PluginAccessService.extract(organizationId, resource)
                ├── summary
                ├── leads      (sem telefone, e-mail, notas)
                └── searches
```

URLs canónicas:

- MCP: `https://api.prospectlyonboard.com/mcp`
- App consentimento: `https://app.prospectlyonboard.com/oauth/consent`
- Local: `http://127.0.0.1:3000/mcp` e `http://localhost:5173/oauth/consent`
- `FRONTEND_URL` já existente constrói o 302 do authorize.

Prefixo Nest hoje: `api` + versioning URI `v1`, exclude só `health*`. **Excluir também** `mcp` e `.well-known/*`.

### Protocolo OAuth

- OAuth 2.1 authorization code + **PKCE S256** (obrigatório). `token_endpoint_auth_method=none` nos clientes públicos.
- `resource` (RFC 8707) = URL exacta do MCP. Ausência ou mismatch → `invalid_target`.
- Scope único: `prospectly.plugin.read`.
- DCR (`POST /api/v1/oauth/register`): `redirect_uri` só `https:` ou loopback (`http://127.0.0.1` / `http://localhost`). Rate limit. Clientes nunca usados expiram.
- Access TTL **15 min**, hashed no Postgres. Refresh **30 dias**, rotação: reuso do refresh antigo revoga a família (igual sessão da app).
- Authorization code TTL **60 s**, one-shot, hashed.
- Audience do access: só `/mcp`. Não abre `/api/v1/*`.

JWT `RefreshToken` da app **não** se reutiliza para o agente.

### Componentes

**Nest `oauth`:** metadata, DCR, authorize, consent, token, revoke.

**Nest `mcp`:** Streamable HTTP. 401 sem Bearer válido inclui `WWW-Authenticate` apontando ao protected-resource metadata. Tools v1 (todas `readOnlyHint`). Transporte: `@modelcontextprotocol/sdk` Streamable HTTP montado no Nest, **só** no módulo `mcp`.

| Tool | extract resource | Input |
|------|------------------|--------|
| `get_org_summary` | `summary` | — |
| `list_leads` | `leads` | `limit` 1–100 (default 25) |
| `list_searches` | `searches` | `limit` 1–100 (default 25) |

**Postgres (Integrations):**

- `OauthClient` — DCR: `clientId`, `clientName`, `redirectUris`, `tokenEndpointAuthMethod`. Não é por org (o cliente é o Cursor, não o tenant).
- `OauthAuthorizationCode` — hash, PKCE, `userId`, `organizationId`, `resource`, `expiresAt`.
- `OauthAccessToken` / `OauthRefreshToken` — hash, `revokedAt`, rotação.
- `McpConnection` (**Ligação MCP**) — `(organizationId, userId, clientId)`; Settings lista/revoga. Revogar marca `revokedAt` e invalida tokens da ligação.

**Web:**

- `/oauth/consent` — sem sessão → `/login?returnUrl=…`. Picker: memberships OWNER/ADMIN. Autorizar / Recusar.
- Settings → Plugins: bloco Ligações MCP (nome do cliente, data, revogar). Card PluginToken **fica**. Mostrar URL `…/mcp`.

**CORS (split):**

- `/api/v1/*` continua allowlist + credentials (app/landing).
- `/mcp` e `/.well-known/*`: CORS aberto (sem cookies), expor `WWW-Authenticate`, `Mcp-Session-Id`, `Mcp-Protocol-Version`. Não alargar `*` ao resto da API.

**Logs / audit:**

- Redigir `Authorization` OAuth (já há path da plugin key).
- `integration.mcp_connection.granted` / `.revoked` no `AuditLog`.
- Rate limit: register, token, `/mcp`.

### Fluxo (primeira ligação)

1. User configura URL MCP no Cursor.
2. `POST /mcp` sem token → 401 + discovery.
3. DCR se necessário.
4. Browser `GET /oauth/authorize` → 302 web consent.
5. Login existente se preciso.
6. Escolhe org OWNER/ADMIN. Recusar → `error=access_denied`. Autorizar → code.
7. Cursor troca code+verifier por tokens.
8. `POST /mcp` Bearer → `initialize` → tools.

Uso: access expirado → refresh. Ligação revogada no Settings → `invalid_grant` / 401 MCP.

Multi-org: segunda org = novo authorize. Token não atravessa tenant.

### Erros

| Caso | Contrato |
|------|----------|
| `/mcp` sem Bearer / token inválido | 401 + `WWW-Authenticate` |
| Audience ≠ MCP | 401 |
| JWT da app ou `pst_…` no `/mcp` | 401 |
| PKCE fail / code reusado / expirado | `invalid_grant` |
| `redirect_uri` ≠ DCR | `invalid_request` |
| `resource` em falta ou ≠ MCP | `invalid_target` |
| Consentimento sem org OWNER/ADMIN | sem code; UI vazia / 403 |
| VIEWER no consent | 403 |
| Ligação revogada | `invalid_grant` no token; 401 no MCP |
| `limit` fora 1–100 | MCP `invalid_params` |
| Falha interna | MCP `internal`; correlation id; sem PII no body |

### Testes

Seam: `PluginAccessService.extract` já cobre “leads sem email/phone”. Não duplicar extract.

**Jest API:** DCR redirect ilegal; PKCE/code; VIEWER 403; audience; refresh reuse mata família; revoke ligação; hashes sem plaintext; tools chamam `extract` da org do token; JWT/`pst_` → 401 no MCP; `POST /mcp` sem token → 401 + header; well-known 200; `/mcp` fora de `/api/v1`; authorize 302 para `/oauth/consent`.

**Vitest web:** consent sem sessão → login+`returnUrl`; picker só OWNER/ADMIN; recusar → `access_denied`; Settings lista/revoga Ligação MCP; PluginToken permanece no ecrã.

**Fora:** Playwright contra Cursor real; E2E OAuth do binário Cursor.

## Aceite

- Cursor (ou cliente MCP HTTP equivalente) completa OAuth e chama as 3 tools contra uma org OWNER/ADMIN.
- `list_leads` nunca inclui telefone, e-mail ou notas.
- PluginToken e `GET /integrations/plugin/v1/data` inalterados no comportamento.
- VIEWER não cria Ligação MCP.
- Um token = uma org.
- `/mcp` rejeita JWT da app e `pst_…`.
- Settings revoga a ligação e o refresh deixa de funcionar.

## Fora de escopo (v1)

- PII de contacto, pipeline, tarefas, relatórios, análises, persona no MCP.
- Tools de escrita (criar lead, mudar estágio, WhatsApp).
- OAuth que substitui PluginToken.
- Serviço `apps/mcp` separado; pacote stdio npm.
- Client ID Metadata Documents (CIMD) além de DCR — só se o cliente obrigar; DCR é o caminho v1.
- Scopes granulares além de `prospectly.plugin.read`.
- Billing/créditos por chamada MCP.
- Copiloto CRM via MCP.

## Fatias de implementação (orientação)

1. OAuth AS + `McpConnection` + ecrã consentimento + Settings revoke.  
2. `/mcp` Streamable HTTP + 3 tools sobre `extract` + well-known + CORS split.

Não misturar Conexão Google nem Sign-In GIS nestas fatias.

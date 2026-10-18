# Domínios Próprios e DNS (`prospectlyonboard.com`)

Topologia de domínios em produção, configuração de DNS no Namecheap, certificados TLS e arquitetura de cookies de autenticação (SEC-001).

---

## 1. Topologia de Domínios em Produção

O Prospectly opera em quatro domínios sob a mesma zona raiz registrável (`prospectlyonboard.com`):

| Domínio                     | Destino / Provedor                | Aplicação            | Finalidade                                       |
| --------------------------- | --------------------------------- | -------------------- | ------------------------------------------------ |
| `api.prospectlyonboard.com` | **Fly.io** (`prospectly-api`)     | API NestJS           | Endpoints REST, autenticação, webhooks e OpenAPI |
| `app.prospectlyonboard.com` | **Vercel** (`prospectly-web`)     | Web React / Vite SPA | Aplicação de prospecção autenticada              |
| `prospectlyonboard.com`     | **Vercel** (`prospectly-landing`) | Next.js 15           | Site institucional (domínio raiz / apex)         |
| `www.prospectlyonboard.com` | **Vercel** (`prospectly-landing`) | Next.js 15           | Redirecionamento canônico para a landing         |

---

## 2. Configuração de DNS no Namecheap

No painel do Namecheap (**Domain List** → **Manage** `prospectlyonboard.com` → **Advanced DNS**):

| Tipo             | Host  | Valor / Alvo                                   | TTL                |
| ---------------- | ----- | ---------------------------------------------- | ------------------ |
| **A Record**     | `api` | IPv4 alocado no Fly.io (`fly ips allocate-v4`) | Automático / 1 min |
| **AAAA Record**  | `api` | IPv6 alocado no Fly.io (`fly ips allocate-v6`) | Automático / 1 min |
| **CNAME Record** | `app` | `cname.vercel-dns.com.`                        | Automático / 1 min |
| **A Record**     | `@`   | `76.76.21.21` (Vercel Anycast IP)              | Automático / 1 min |
| **CNAME Record** | `www` | `cname.vercel-dns.com.`                        | Automático / 1 min |

---

## 3. Emissão de Certificados TLS

### Fly.io (`api.prospectlyonboard.com`)

Após configurar os registros DNS no Namecheap, adicione e verifique o certificado no Fly:

```bash
# Adicionar o certificado
fly certs add api.prospectlyonboard.com -a prospectly-api

# Verificar status da emissão
fly certs show api.prospectlyonboard.com -a prospectly-api
```

### Vercel (`app.prospectlyonboard.com`, `prospectlyonboard.com`, `www.prospectlyonboard.com`)

No dashboard de cada projeto na Vercel:

1. Vá em **Settings** → **Domains**.
2. Adicione os respectivos domínios; a Vercel valida a propagação do DNS e provisiona os certificados Let's Encrypt automaticamente.

---

## 4. Política de Cookies e Sessão (SEC-001)

### Por que `SameSite=Lax` funciona entre `app.` e `api.`?

Tanto `app.prospectlyonboard.com` quanto `api.prospectlyonboard.com` compartilham o mesmo domínio registrável (`prospectlyonboard.com`). Pela especificação de cookies do IETF:

- Requisições da Web SPA para a API são consideradas **same-site** (embora sejam cross-origin por diferirem no subdomínio).
- O cookie de refresh é configurado com:
  - `HttpOnly`: Inacessível por JavaScript.
  - `Secure`: Transmitido unicamente sobre HTTPS.
  - `SameSite=Lax`: Permitido em requisições de mesma zona registrável e navegações top-level.
  - **Host-only:** Sem atributo `Domain=`. O cookie é restrito ao host da API (`api.prospectlyonboard.com`), impedindo que outros subdomínios leiam o cookie diretamente.

### Variáveis de Ambiente no Backend

No `fly.toml`:

```toml
[env]
  REFRESH_COOKIE_SAME_SITE = "lax"
  FRONTEND_URL = "https://app.prospectlyonboard.com"
  CORS_ORIGINS = "https://app.prospectlyonboard.com,https://prospectlyonboard.com"
```

---

## 5. Integrações Externas e Redirects

### Google OAuth (Cloud Console)

No Google Cloud Console → **APIs & Services** → **Credentials**:

1. **Authorized JavaScript Origins:**
   - `https://app.prospectlyonboard.com`
   - `http://localhost:5173` (para desenvolvimento local)
2. **Authorized Redirect URIs:**
   - `https://api.prospectlyonboard.com/api/v1/google-connections/callback`
   - `http://localhost:3000/api/v1/google-connections/callback` (desenvolvimento local)

Configure também a variável do backend; cadastrar o URI no Google Console não altera o fallback local do código:

```bash
fly secrets set -a prospectly-api \
  GOOGLE_OAUTH_REDIRECT_URI="https://api.prospectlyonboard.com/api/v1/google-connections/callback"
```

### Webhook Asaas

No painel do Asaas (Produção):

- **URL do Webhook:** `https://api.prospectlyonboard.com/api/v1/billing/webhook/asaas`
- **Token de Autenticação:** Deve corresponder ao valor de `ASAAS_WEBHOOK_TOKEN` configurado nas secrets do Fly.
- **Cabeçalho:** `asaas-access-token`

---

## 6. Validação e Testes de Conectividade

```bash
# 1. Health check da API no host próprio
curl -i https://api.prospectlyonboard.com/health/ready
# Esperado: HTTP 200 {"status":"ready","timestamp":"<ISO-8601>"}

# 2. Executar probe Playwright da Web SPA
pnpm --filter @prospectly/web exec playwright test --config playwright.probe.config.ts
```

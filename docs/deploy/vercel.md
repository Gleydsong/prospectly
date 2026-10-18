# Deploy do Prospectly na Vercel (Web e Landing)

Hospedagem das aplicações frontend na Vercel:

- **`apps/web`**: SPA React/Vite autenticada em `app.prospectlyonboard.com`.
- **`apps/landing`**: Site institucional em Next.js 15 em `prospectlyonboard.com` e `www.prospectlyonboard.com`.

Ambos os projetos são configurados a partir do monorepo pnpm com definições declarativas em seus respectivos `vercel.json`.

---

## 1. Web SPA (`apps/web`)

### Configuração do Projeto na Vercel

| Configuração                                    | Valor                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Project Name**                                | `prospectly-web`                                                                                  |
| **Framework Preset**                            | `Vite`                                                                                            |
| **Root Directory**                              | `apps/web`                                                                                        |
| **Include source files outside Root Directory** | **Habilitado** (essencial para resolver pacotes do monorepo pnpm como `@prospectly/shared-types`) |
| **Build Command**                               | `pnpm --filter @prospectly/web build`                                                             |
| **Output Directory**                            | `dist` (relativo a `apps/web`)                                                                    |
| **Domínio canônico**                            | `app.prospectlyonboard.com`                                                                       |

### Arquivo declarativo: `apps/web/vercel.json`

O arquivo [`apps/web/vercel.json`](../../apps/web/vercel.json) define roteamento de SPA e paridade estrita com os headers de segurança do `nginx.conf`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "pnpm --filter @prospectly/web build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=2592000, immutable"
        }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=15552000; includeSubDomains"
        },
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin-allow-popups"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https:; connect-src 'self' https: https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com; frame-src https://accounts.google.com"
        }
      ]
    }
  ]
}
```

#### Destaques de Segurança e Cache

- **Rewrite SPA:** `/(.*)` → `/index.html` resolve navegações client-side com React Router. Arquivos estáticos reais têm precedência de resolução no filesystem da Vercel.
- **Cache de Assets:** `/assets/(.*)` recebe `max-age=2592000` (30 dias, igual à diretiva `expires 30d` do nginx). A rota raiz não é cacheada imutavelmente para permitir atualizações instantâneas do bundle.
- **COOP:** `Cross-Origin-Opener-Policy: same-origin-allow-popups` para suporte a popups de autenticação Google OAuth.
- **CSP:** `connect-src` autoriza conexões com `https://api.prospectlyonboard.com` e endpoints de autenticação Google.

### Variáveis de Ambiente de Build (`apps/web`)

Variáveis com prefixo `VITE_*` são incorporadas ao bundle durante o build (rebuild obrigatório ao alterar):

| Variável                | Valor de Produção                          | Descrição                                   |
| ----------------------- | ------------------------------------------ | ------------------------------------------- |
| `VITE_API_URL`          | `https://api.prospectlyonboard.com/api/v1` | URL pública da API NestJS no Fly.io         |
| `VITE_LANDING_URL`      | `https://prospectlyonboard.com`            | URL canônica do site institucional          |
| `VITE_GOOGLE_CLIENT_ID` | `<GOOGLE_CLIENT_ID_PUBLICO>`               | Client ID do Google OAuth Web para Sign-In  |
| `VITE_SENTRY_DSN`       | _(Opcional)_                               | DSN para monitoramento de erros no frontend |

---

## 2. Landing Page (`apps/landing`)

### Configuração do Projeto na Vercel

| Configuração                                    | Valor                                                        |
| ----------------------------------------------- | ------------------------------------------------------------ |
| **Project Name**                                | `prospectly-landing`                                         |
| **Framework Preset**                            | `Next.js`                                                    |
| **Root Directory**                              | `apps/landing`                                               |
| **Include source files outside Root Directory** | **Habilitado** (workspace pnpm)                              |
| **Build Command**                               | `pnpm build` (padrão Next.js)                                |
| **Domínios canônicos**                          | `prospectlyonboard.com` (apex) e `www.prospectlyonboard.com` |

### Arquivos declarativos: `apps/landing/vercel.json` e `next.config.ts`

- [`apps/landing/vercel.json`](../../apps/landing/vercel.json):
  ```json
  {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "framework": "nextjs"
  }
  ```
- [`apps/landing/next.config.ts`](../../apps/landing/next.config.ts):
  - `poweredByHeader: false` remove o header `X-Powered-By`.
  - Headers de segurança configurados via `headers()`.
  - Redirecionamentos de rotas legadas `/v2` e FAQ via `redirects()`. O redirecionamento de `www` para o apex deve ser configurado no projeto Vercel; não é implementado pelo Next.js.
  - O handler [`src/app/api/waitlist/route.ts`](../../apps/landing/src/app/api/waitlist/route.ts) valida e encaminha requisições `POST` à API NestJS (`/api/v1/waitlist`).

### Variáveis de Ambiente (`apps/landing`)

| Variável                  | Escopo           | Valor de Produção                          | Finalidade                                                              |
| ------------------------- | ---------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`     | Pública / Build  | `https://app.prospectlyonboard.com`        | Destino de botões de login, cadastro e call-to-action                   |
| `NEXT_PUBLIC_LANDING_URL` | Pública / Build  | `https://prospectlyonboard.com`            | Origem canônica do site institucional                                   |
| `NEXT_PUBLIC_API_URL`     | Pública / Build  | `https://api.prospectlyonboard.com/api/v1` | Fallback para chamadas à API                                            |
| `WAITLIST_API_URL`        | Somente Servidor | `https://api.prospectlyonboard.com/api/v1` | Base para o handler da rota de API `/api/waitlist` encaminhar cadastros |

---

## 3. Checklist de Provisionamento Vercel

1. **Importar o Repositório no Dashboard Vercel:**
   - Criar projeto `prospectly-web` apontando para `apps/web`.
   - Criar projeto `prospectly-landing` apontando para `apps/landing`.
2. **Configurar Monorepo Settings:**
   - Em ambos os projetos: Settings → General → Root Directory → marcar _Include source files outside of the Root Directory in the Build Step_.
3. **Preencher Variáveis de Ambiente:**
   - Inserir as tabelas de `VITE_*` no `prospectly-web`.
   - Inserir as tabelas de `NEXT_PUBLIC_*` e `WAITLIST_API_URL` no `prospectly-landing`.
4. **Adicionar Domínios Customizados:**
   - `prospectly-web`: `app.prospectlyonboard.com` (CNAME `cname.vercel-dns.com`).
   - `prospectly-landing`: `prospectlyonboard.com` (A `76.76.21.21`) e `www.prospectlyonboard.com` (CNAME `cname.vercel-dns.com`).
5. **Verificação pós-deploy:**
   - Acesso a `https://app.prospectlyonboard.com` carrega o login.
   - F5 em rotas profundas (`/login`, `/register`) funciona sem erro 404.
   - Inscrição na waitlist em `https://prospectlyonboard.com` encaminha para a API com sucesso.

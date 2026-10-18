# Arquitetura de Deploy e Produção do Prospectly

A configuração versionada define a topologia alvo dividida entre **Fly.io** (backend e dados) e **Vercel** (frontend e marketing).

Provisionamento, DNS e smoke reais são o gate humano da [issue #338](https://github.com/Gleydsong/prospectly/issues/338); este guia não atesta que serviços já foram implantados.

---

## 1. Mapa de Componentes em Produção

```
                                 [ DNS Namecheap ]
                             prospectlyonboard.com
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
   api.prospectlyonboard.com   app.prospectlyonboard.com   prospectlyonboard.com
            │                          │                  www.prospectlyonboard.com
            ▼                          ▼                          │
       ┌─────────┐                ┌─────────┐                     ▼
       │ Fly.io  │                │ Vercel  │                ┌─────────┐
       │ (gru)   │                │ (Edge)  │                │ Vercel  │
       └────┬────┘                └─────────┘                │ (Edge)  │
            │                      React SPA                 └─────────┘
            ├────────────────┐     (apps/web)                 Next.js 15
            ▼                ▼                               (apps/landing)
     ┌─────────────┐  ┌─────────────┐
     │  NestJS API │  │   Worker    │
     │  (ROLE=api) │  │(ROLE=worker)│
     └──────┬──────┘  └──────┬──────┘
            │                │
            └────────┬───────┘
                     │ (Rede Privada Flycast)
                     ├──────────────────────────┐
                     ▼                          ▼
              ┌─────────────┐            ┌─────────────┐
              │ Postgres 16 │            │    Redis    │
              │  (RLS app)  │            │(noeviction) │
              └─────────────┘            └─────────────┘
```

---

## 2. Guias de Implementação e Operação

A documentação detalhada de deploy está dividida nos seguintes tópicos:

1. **[Backend no Fly.io (`fly.md`)](./fly.md)**
   - Configuração de `prospectly-api` na região `gru` (São Paulo).
   - Processos `app` (API NestJS) e `worker` (BullMQ) a partir da mesma imagem compartilhada.
   - Cluster PostgreSQL e instância Redis com persistência e política `noeviction`.
   - Dimensionamento de máquinas (`fly scale count app=1 worker=1`).
   - Tabela de variáveis de ambiente públicas e secrets de produção.

2. **[Frontend na Vercel (`vercel.md`)](./vercel.md)**
   - Configuração de `prospectly-web` (SPA React/Vite) em `app.prospectlyonboard.com`.
   - Configuração de `prospectly-landing` (Next.js 15) em `prospectlyonboard.com`.
   - Roteamento de SPA e headers de segurança (CSP, COOP, HSTS, cache imutável de assets).
   - Rota de proxy `/api/waitlist` para inscrição na landing page.

3. **[Migrations de Banco de Dados (`migrations.md`)](./migrations.md)**
   - Execução única por release via `release_command = "./scripts/fly-release.sh"`.
   - Segregação de privilégios: `MIGRATION_DATABASE_URL` (owner com `BYPASSRLS`) versus `DATABASE_APP_URL` (`prospectly_app` com RLS ativo).
   - Estratégia expand/contract e procedimentos de rollback.

4. **[Workers BullMQ (`workers.md`)](./workers.md)**
   - Arquitetura de worker separado sem portas HTTP abertas.
   - Catálogo dos 8 processors ativos e do `GmailSyncScheduler`.
   - Gestão de conexões PostgreSQL e Redis; graceful shutdown.

5. **[Domínios e DNS (`api-custom-domain.md`)](./api-custom-domain.md)**
   - Mapeamento de registros DNS no Namecheap.
   - Emissão de certificados TLS via Fly.io e Vercel.
   - Arquitetura de cookies de autenticação `SameSite=Lax` sob o mesmo domínio registrável (SEC-001).
   - Configurações de Google OAuth e webhooks de pagamento Asaas.

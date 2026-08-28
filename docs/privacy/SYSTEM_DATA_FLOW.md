# System data flow — Prospectly

Última revisão técnica: 2026-08-28  
Este documento descreve o sistema **como implementado**, não uma declaração jurídica de conformidade.

## Aplicações

| App | Stack | Papel |
| --- | --- | --- |
| `apps/web` | Vite + React | SPA autenticada (CRM, buscas, billing, privacidade) |
| `apps/api` | NestJS + Prisma + BullMQ | REST `/api/v1`, workers inline |
| `apps/landing` | Next.js | Marketing, waitlist, páginas legais, cookies |

## Persistência e runtime

- **PostgreSQL:** dados de conta, tenants, leads, billing, DSR, consentimento, suppression (hash), audit.
- **Redis:** filas BullMQ, rate limit, slot Nominatim. Payloads de job são IDs, não e-mail/telefone.
- **Row-Level Security:** `FORCE ROW LEVEL SECURITY` + Prisma `$extends` + ALS (`organizationId` do JWT).
- **Object storage / vector DB / search engine:** ausentes neste tree.

## Identidade

```
Browser → POST /auth/register|/login|/google
       → Argon2 (senha) + JWT access (memória) + refresh HttpOnly cookie
       → organizationId e role no JWT, revalidados na membership
```

Access token **não** vai para `localStorage`. Refresh exige header CSRF `X-Requested-With`.

## Superfícies que tocam dados pessoais

1. Cadastro / login / OAuth Google / reset de senha / verificação de e-mail
2. Perfil (`/users/me`), correção (`/privacy/correction`)
3. CRM de leads (CRUD, CSV, OSM, Google Places, Opportunity Finder)
4. Campanhas (OPT_OUT → `doNotContact` + suppression hash)
5. Billing (AbacatePay PIX, Asaas cartão sob flag; `BillingProfile.cpfCnpj`)
6. Waitlist da landing
7. IA local Ollama (Opportunity Finder + variantes WhatsApp) — PII de contacto omitida no prompt
8. Logs Pino (redaction) e `AuditLog` (metadados sanitizados)
9. Export/exclusão do titular (`/privacy/export`, `/privacy/account`)

## O que não existe neste código

- Analytics de produto (GA, PostHog, Mixpanel) no Prospectly
- Session replay
- SDK Sentry ativo (stub + `SENTRY_DSN`)
- Conversion Studio / RAG / embeddings
- Worker Render dedicado (processors no processo da API)
- Envio automático de WhatsApp/e-mail de outreach

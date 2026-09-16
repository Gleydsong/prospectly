# Design: DMARC + From sem no-reply (v1)

**Data:** 2026-09-15  
**Status:** Aprovado em conversa (humano). Pronto para implementar.  
**Branch:** `feat/email-dmarc-from`  
**Base:** `origin/main` @ `b7e9075` (PR 264 merged)

## Problem Statement

O Gmail (Needs attention) mostrou dois avisos nos envios Prospectly:

1. **Incluir registro DMARC válido** — `No DMARC record found` em `prospectlyonboard.com`.
2. **Não use "sem resposta"** — `From: Prospectly <no-reply@prospectlyonboard.com>`.

DNS público confirmou: `_dmarc.prospectlyonboard.com` vazio; apex sem SPF (só Google site verification). DKIM Resend existe em `resend._domainkey.prospectlyonboard.com`. SPF Resend existe em `send.prospectlyonboard.com` (`include:amazonses.com`). O From `no-reply@` vem de `RESEND_FROM` / `SMTP_FROM` (`.env.example` e Render dashboard, `sync: false`).

## Solution

Dois eixos. O código não publica DNS.

### A. DNS (humano, Namecheap — NS `registrar-servers.com`)

Manter o TXT de `google-site-verification` no apex. Adicionar **novos** TXT (não substituir o da Google):

1. Host `_dmarc` (ou `_dmarc.prospectlyonboard.com` conforme UI):

   `v=DMARC1; p=none; rua=mailto:hello@prospectlyonboard.com`

   Começar com `p=none`. Não subir para `quarantine`/`reject` nesta fatia.

2. Host `@` (apex), TXT adicional:

   `v=spf1 include:amazonses.com ~all`

Apex não tem MX hoje. Replies para `hello@` podem falhar até existir MX/alias no Google Workspace. Esta fatia **não** cria mailbox; o aviso Gmail é o local-part `no-reply`. Documentar o gap de MX no PR.

### B. App + Render

From canónico: `Prospectly <hello@prospectlyonboard.com>`.

- `RESEND_FROM` e `SMTP_FROM` no `.env.example`.
- Fallback em `configuration.ts` / `mail.service.ts`: deixar de usar `no-reply@prospectly.dev` / `no-reply@prospectlyonboard.com`.
- Testes que hardcodam o From antigo.
- Docs go-live A20: exemplo sem `no-reply`.
- Produção: atualizar `RESEND_FROM` e `SMTP_FROM` no serviço API (e worker se tiver) no Render. `render.yaml` permanece `sync: false`.

Não inventar domínio. Não alterar templates HTML. Sem persona/CRM.

## Aceite

- Código e example env não sugerem `no-reply@`.
- `mail.service.spec` envia com `hello@prospectlyonboard.com` quando o config diz isso.
- Humano confirma TXT `_dmarc` visível (`dig TXT _dmarc.prospectlyonboard.com`) e From novo num e-mail real após deploy.
- Sem merge até sim humano.

## Fora de escopo

- Política DMARC `quarantine`/`reject`.
- Criar inbox `hello@` / MX no apex.
- Autenticar MCP Resend.
- Apagar `feat/persona-other-label` remota.

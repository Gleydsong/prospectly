# Hardening de segurança (SEC-001 + SEC-017 + remediações de auditoria)

**Data:** 2026-07-26  
**Branch:** `feat/security-hardening-fixes`  
**Status:** Implementado (branch `feat/security-hardening-fixes`)

## Decisões

1. **SEC-001:** Refresh token em cookie `HttpOnly` + `Secure` + `SameSite=Lax`; access JWT só em memória (spike Opção A).
2. **SEC-017:** Login permitido sem e-mail verificado; o **backend** exige `emailVerifiedAt` nas mutações críticas; o frontend é só UX.

## Endpoints críticos (`RequireEmailVerified`)

- Billing: checkout, portal, cancel
- Org: convite / atualizar papel / remover membro / renomear
- Users: data-requests (export/exclusão)
- Auth: change-password
- Scoring: PATCH rules
- Imports: criação de CSV

## Contrato do cookie

- Login/register/google/switch: `Set-Cookie: refresh_token=...; HttpOnly; Secure(prod); Path=/api/v1/auth; SameSite=Lax`
- Body omite `refreshToken`; mantém `accessToken` + `user`
- Refresh/logout: cookie + header CSRF `X-Requested-With: XMLHttpRequest`

## CSP residual da landing

O `next.config.ts` da landing ainda permite `'unsafe-inline'` / `'unsafe-eval'` por causa do Next.js + Motion. Apertar mais fica adiado até CSP com nonce ser viável.

## Verificação de e-mail

- Token de uso único, expiração, hash SHA-256, rate limit de resend, invalidação de tokens antigos
- Mensagens anti-enumeração; logs estruturados sem token cru
- Change-email exige senha atual; reemite verificação

## Checklist de go-live

- [ ] Secrets JWT fortes (sem `change-me-*`) em production/staging
- [ ] `prisma migrate deploy` inclui `RefreshToken.organizationId` + `emailVerifyTokenExpiresAt`
- [ ] SMTP configurado (`SMTP_HOST` / from); e-mail de cadastro chega
- [ ] Deploy atômico de API + web (contrato do cookie)
- [ ] Headers Render: COOP / HSTS / CSP connect-src
- [ ] Webhook Abacate prefere header `X-Abacate-Webhook-Secret`
- [ ] Throttler Redis saudável (mesmo Redis do BullMQ)
- [ ] Smoke: F5 restaura sessão; logout limpa cookie; não verificado não faz checkout

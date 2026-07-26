# Security hardening (SEC-001 + SEC-017 + audit remediations)

**Date:** 2026-07-26  
**Branch:** `feat/security-hardening-fixes`  
**Status:** Implemented (branch `feat/security-hardening-fixes`)

## Decisions

1. **SEC-001:** Refresh token in `HttpOnly` + `Secure` + `SameSite=Lax` cookie; access JWT in memory only (spike Option A).
2. **SEC-017:** Login allowed without verified email; **backend** requires `emailVerifiedAt` on critical mutations; frontend is UX only.

## Critical endpoints (RequireEmailVerified)

- Billing: checkout, portal, cancel
- Org: invite / update role / remove member / rename
- Users: data-requests (export/delete)
- Auth: change-password
- Scoring: PATCH rules
- Imports: CSV create

## Cookie contract

- Login/register/google/switch: `Set-Cookie: refresh_token=...; HttpOnly; Secure(prod); Path=/api/v1/auth; SameSite=Lax`
- Body omits `refreshToken`; keeps `accessToken` + `user`
- Refresh/logout: cookie + CSRF header `X-Requested-With: XMLHttpRequest`

## Landing CSP residual

Landing `next.config.ts` still allows `'unsafe-inline'` / `'unsafe-eval'` for Next.js + Motion. Tightening further is deferred until nonce-based CSP is feasible.

## Email verification

- Single-use token, expiry, SHA-256 hash storage, resend rate limit, invalidate old tokens
- Anti-enumeration messages; structured logs without raw token
- Change-email requires current password; re-issues verification

## Go-live checklist

- [ ] Strong JWT secrets (no `change-me-*`) in production/staging
- [ ] `prisma migrate deploy` includes `RefreshToken.organizationId` + `emailVerifyTokenExpiresAt`
- [ ] SMTP configured (`SMTP_HOST` / from); verify registration email arrives
- [ ] Deploy API + web atomically (cookie contract)
- [ ] Render headers: COOP / HSTS / CSP connect-src
- [ ] Abacate webhook prefers `X-Abacate-Webhook-Secret` header
- [ ] Redis throttler healthy (same Redis as BullMQ)
- [ ] Smoke: F5 session restore; logout clears cookie; unverified cannot checkout

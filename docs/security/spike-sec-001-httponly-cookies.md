# Spike SEC-001 — Sessão com cookies HttpOnly

**Status:** documentado (não implementado nesta rodada)  
**Data:** 2026-07-25  
**Branch:** `cursor/security-hardening`

## Problema

Hoje o web app persiste `accessToken` + `refreshToken` em `localStorage` via Zustand (`apps/web/src/stores/auth.store.ts`). Qualquer XSS no app consegue roubar a sessão completa.

## Objetivo

1. **Refresh token** apenas em cookie `HttpOnly` + `Secure` + `SameSite=Lax` (ou `Strict` se mesmo site).
2. **Access token** só em memória (Zustand sem `persist` para tokens).
3. CSRF protection nas mutações que dependem do cookie de refresh.
4. Logout limpa cookie no servidor.

## Opções avaliadas

| Opção | Prós | Contras |
|-------|------|---------|
| **A. Cookie só no refresh** (recomendada) | Menor mudança; access continua no `Authorization` header | Precisa CSRF no `/auth/refresh` e `/auth/logout` |
| **B. BFF same-origin** | Cookie first-party natural; sem CORS token | Novo serviço / rewrite Next ou Vite proxy em prod |
| **C. Cookie access + refresh** | Zero tokens no JS | CSRF em todas as mutações; mais complexo |

**Decisão proposta:** Opção A, com proxy same-origin em produção (`/api` → API) para `SameSite=Lax` sem cross-site.

## Contrato alvo

### API

- `POST /auth/login` e `POST /auth/register`: setam `Set-Cookie: refresh_token=...; HttpOnly; Secure; Path=/api/v1/auth; SameSite=Lax; Max-Age=...`
- Body de resposta **não** inclui `refreshToken` (breaking change documentado; web atualizado em lockstep).
- `POST /auth/refresh`: lê cookie (fallback temporário: body, 1 release).
- `POST /auth/logout`: clear cookie + revoke jti.
- Em reuse detection (já implementado): `logoutAll` + clear cookie.

### Web

- Remover `refreshToken` do `persist`.
- Axios: refresh chama `/auth/refresh` com `withCredentials: true` e sem body.
- Access token permanece em memória; ao F5, um bootstrap `POST /auth/refresh` restaura a sessão se o cookie for válido.

### CSRF

- Double-submit cookie (`csrf_token` não-HttpOnly) **ou** header custom exigido em rotas cookie-authenticated.
- Preferência: `SameSite=Lax` + refresh só em POST same-site já reduz muito o risco; reforçar com header `X-Requested-With` ou CSRF token se API e web forem cross-origin.

## Escopo estimado

| Trabalho | Esforço |
|----------|---------|
| Cookie helpers + auth.service/controller | 1–2d |
| Web axios + auth store + bootstrap | 1–2d |
| CORS `credentials` + origins | 0.5d |
| Testes e2e login/refresh/logout | 1d |
| Migração clientes (breaking) | 0.5d |

**Total:** ~4–6 dias úteis. Fora do escopo seguro desta rodada sem feature flag e janela de deploy coordenada.

## Pré-requisitos já feitos (Fases 1–2)

- Refresh reuse → `logoutAll`
- Throttle em `/auth/refresh`
- CORS já com `credentials: true`
- Swagger off em production

## SEC-017 — Email verification gate

Endpoint `verifyEmail` já existe; campo `emailVerifiedAt` no User.

**Proposta:** flag `REQUIRE_EMAIL_VERIFICATION=false` (default). Quando `true`:

- bloquear login/ações se `emailVerifiedAt` for null (exceto rotas de verify/forgot);
- reenviar token com throttle.

Produto precisa decidir se free tier exige verificação antes de habilitar o gate. **Adiado** junto com este spike.

## Critério de pronto (quando implementar)

- [ ] Tokens não aparecem em Application → Local Storage
- [ ] DevTools → Cookies mostra refresh HttpOnly
- [ ] XSS simulado no console não lê refresh
- [ ] Refresh reuse ainda revoga família
- [ ] E2E: login → F5 → sessão restaura; logout → cookie limpo

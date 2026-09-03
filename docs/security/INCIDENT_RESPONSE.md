# Incident response (técnico)

Última revisão: 2026-08-28  
Prazos e deveres de comunicação à ANPD/titulares: `LEGAL_REVIEW_REQUIRED`.

## Detecção

- Falhas de auth / lockout (`failedLoginAttempts`, `lockedUntil`)
- TenantScopeError / 404 cross-tenant (não vazar existência)
- Spike de export CSV / `/privacy/export` (throttle + audit `privacy.data_exported`)
- Jobs BullMQ failed; `GET /health/ready` (Postgres); `ops/metrics.redis` e `reliability`
- `pnpm audit` + `scripts/secret-scan.cjs` no CI
- Alertas de host (Render) — configurar no dashboard

## Contenção

1. Rotacionar `JWT_*`, `DATABASE_*`, API keys de gateways e Places.
2. Revogar refresh tokens (`logoutAll` / `refreshToken.updateMany`).
3. Desligar feature flags (`ASAAS_ENABLED`, `*_AI_ENABLED`) se o vetor for integração.
4. Isolar tenant afetado (não desligar RLS).

## Investigação

Usar `AuditLog` (action, entityId, metadata redacted, ip) + correlation id HTTP.  
**Não** gravar bodies completos em tickets. Restaurar backup só em ambiente isolado.

## Erradicação / Recuperação

Patch + migrate; invalidar sessões; reemitir cookies Secure. Smoke: login, F5 refresh, export próprio, tentativa cross-tenant 404.

## Avaliação de impacto (técnico)

Campos: tenants, userIds (não e-mails em canal público), tabelas, janela temporal, provedor (OSM/LLM/PSP).  
`BillingProfile.cpfCnpj` e `Lead.email/phone` são as categorias de maior impacto.

## Preservação de evidências

Snapshot DB read-only; logs Pino com redact; **não** copiar produção para laptop de dev.

## Avaliação jurídica / notificação

Acionar encarregado/DPO e assessoria. Este runbook **não** define se notificar ANPD.

## Postmortem

Causa raiz, blast radius, controlo que falhou, teste de regressão, owner. Sem PII no postmortem público.

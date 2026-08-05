# LGPD checklist — Prospectly SaaS MVP

Última revisão: 2026-08-01

## Entregue nesta branch

| Item | Status |
| --- | --- |
| Política de Privacidade (`/privacy`) | Feito (landing PT + resumo EN) |
| Termos de Uso (`/terms`) | Feito |
| Política de Cookies (`/cookies`) | Feito |
| Banner de cookies (essenciais; analytics off) | Feito na landing |
| Consentimento no register (`acceptTerms` + `termsAcceptedAt` / `termsVersion`) | Feito |
| Soft gate de plano + billing Stripe | Feito |
| Stub DSR (`POST /users/me/data-requests`) | Feito |
| Audit log operacional (`AuditService`) | Feito (stage, import, membros/settings, DSR) |
| Workflow DSR admin (`GET/approve/complete` OWNER) | Feito (stub assíncrono + confirmação) |
| Inventário / ROPA stub | Ver `docs/saas-mvp/ropa-stub.md` |

## Gaps remanescentes (fase 2+)

- [ ] Nomear DPO / encarregado e publicar canal dedicado além de `privacy@prospectly.dev`
- [ ] RIPD (Relatório de Impacto) para prospecção com dados de pessoas físicas identificáveis
- [ ] Inventário formal de subprocessadores (Stripe, Redis, Postgres host, Render/Vercel, Google Places, OSM) — rascunho em ROPA stub
- [ ] Automação completa de exclusão/exportação (`DELETE /me` end-to-end + retenção)
- [ ] Política de retenção documentada com prazos por entidade (User, Lead, AuditLog)
- [ ] SCCs / cláusulas para transferências internacionais quando aplicável
- [ ] ROPA completo (substituir stub)
- [ ] Opt-in analytics com base legal distinta

## Notas de produto

Dados públicos de mapas **não isentam** finalidade, transparência e direitos do titular quando telefone/e-mail identificam pessoa física (ex.: MEI). O outreach do cliente final permanece sob responsabilidade do controlador contratante (organização usuária), com o Prospectly como operador do SaaS.

## Workflow DSR (MVP)

1. Titular: `POST /v1/users/me/data-requests` → `PENDING`
2. OWNER: `GET /v1/users/data-requests` (membros da org)
3. OWNER: `POST /v1/users/data-requests/:id/approve` → `APPROVED` + stub assíncrono
4. Stub / OWNER: completa com `confirmationSentAt`, `confirmationChannel`, `confirmationNote`
5. Eventos gravados em `AuditLog` sem senhas/tokens/CSV

# LGPD checklist — Prospectly SaaS MVP

Última revisão: 2026-07-25

## Entregue nesta branch

| Item | Status |
| --- | --- |
| Política de Privacidade (`/privacy`) | Feito (landing PT + resumo EN) |
| Termos de Uso (`/terms`) | Feito |
| Política de Cookies (`/cookies`) | Feito |
| Banner de cookies (essenciais; analytics off) | Feito na landing |
| Consentimento no register (`acceptTerms` + `termsAcceptedAt` / `termsVersion`) | Feito |
| Soft gate de plano + billing Stripe | Feito |
| Stub DSR (`POST /users/me/data-requests`) | Feito (processamento manual) |

## Gaps remanescentes (fase 2+)

- [ ] Nomear DPO / encarregado e publicar canal dedicado além de `privacy@prospectly.dev`
- [ ] RIPD (Relatório de Impacto) para prospecção com dados de pessoas físicas identificáveis
- [ ] Inventário formal de subprocessadores (Stripe, Redis, Postgres host, Render/Vercel, Google Places, OSM)
- [ ] Automação completa de exclusão/exportação (`DELETE /me` end-to-end + retenção)
- [ ] Política de retenção documentada com prazos por entidade (User, Lead, AuditLog)
- [ ] SCCs / cláusulas para transferências internacionais quando aplicável
- [ ] Registro de atividades de tratamento (ROPA)
- [ ] Opt-in analytics com base legal distinta

## Notas de produto

Dados públicos de mapas **não isentam** finalidade, transparência e direitos do titular quando telefone/e-mail identificam pessoa física (ex.: MEI). O outreach do cliente final permanece sob responsabilidade do controlador contratante (organização usuária), com o Prospectly como operador do SaaS.

# LGPD checklist — Prospectly SaaS MVP

Última revisão: 2026-08-28

Inventário completo: `docs/privacy/LGPD_AUDIT.md`.

## Entregue

| Item | Status |
| --- | --- |
| Política de Privacidade (`/privacy`) | Atualizada (rotas reais de export/delete) |
| Termos de Uso (`/terms`) | Feito |
| Política de Cookies (`/cookies`) | Feito |
| Banner de cookies (essenciais; analytics off) | Versionado na landing |
| Consentimento no register + `ConsentRecord` | Feito |
| Export JSON `GET /privacy/export` | Feito |
| Exclusão/anonimização `DELETE /privacy/account` | Feito (bloqueia last OWNER) |
| DSR admin (`GET/approve/complete`) | Approve executa DELETE real |
| Suppression list hashed | Feito |
| Audit log operacional | Feito |
| Inventário / ROPA | `docs/privacy/*` + stub legado |

## Gaps (jurídico / produto)

- [ ] Nomear DPO / encarregado
- [ ] RIPD formal de prospecção
- [ ] DPA / SCCs subprocessadores
- [ ] Cifrar `BillingProfile.cpfCnpj` ou tokenizar no PSP
- [ ] Opt-out público do titular-lead
- [ ] Retenção AuditLog / waitlist / backups
- [ ] Soft-delete de lead ≠ erasure

## Notas de produto

Dados públicos de mapas **não isentam** finalidade, transparência e direitos do titular quando telefone/e-mail identificam pessoa física (ex.: MEI). O outreach do cliente final permanece sob responsabilidade do controlador contratante (organização usuária), com o Prospectly como operador do SaaS.

## Workflow DSR

1. Titular: `GET /v1/privacy/export` (imediato) ou `POST /v1/privacy/requests`
2. Titular: `DELETE /v1/privacy/account` (anonimização; 409 se last OWNER)
3. OWNER: `GET /v1/users/data-requests` → `POST .../approve` (DELETE executa erasure)
4. Eventos em `AuditLog` sem senhas/tokens/CSV

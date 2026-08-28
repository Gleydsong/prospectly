# Privacy engineering — Prospectly

## Papéis

- **Controlador (leads/CRM/outreach):** organização cliente (tenant).
- **Operador (SaaS):** Prospectly (hospedagem, filas, IA assistida, billing da conta).
- **Titular (conta):** usuário autenticado.
- **Titular (lead):** possível PF/MEI nos contactos prospectados — o produto **não** oferece portal a esse titular; o cliente deve honrar pedidos. Suppression list é a salvaguarda técnica de reimport.

## Controlos implementados (2026-08-28)

- Privacy by default no cadastro: `acceptTerms` obrigatório, checkbox não pré-marcado.
- ConsentRecord com tipo, versão, source, timestamps, withdraw.
- Export JSON do titular; exclusão por anonimização; bloqueio last OWNER.
- Suppression hash (SHA-256) por org (e-mail/telefone/domínio).
- LLM sanitizer allowlist + strip de chaves bloqueadas.
- Pino redact compartilhado API/worker (inclui cpfCnpj, query secrets).
- CSV formula escaping.
- Job de retenção BullMQ 24h.
- RLS + tenant guard inclui `SuppressionEntry`; `ConsentRecord` por `userId`.
- Cookie banner: essenciais only; analytics off; persistência versionada.

## Endpoints de privacidade

| Método | Rota | Notas |
| --- | --- | --- |
| GET | `/api/v1/privacy/me` | Snapshot conta + consents |
| GET | `/api/v1/privacy/export` | JSON attachment; throttle 5/min; e-mail verificado |
| POST | `/api/v1/privacy/requests` | DSR tracking (ACCESS/EXPORT/DELETION/…) |
| POST | `/api/v1/privacy/correction` | Nome |
| POST/GET/DELETE | `/api/v1/privacy/consent` | Histórico |
| DELETE | `/api/v1/privacy/account` | Anonimização |

Workflow admin OWNER (`/users/data-requests/:id/approve`) agora **executa** DELETE (anonimização) em vez de stub.

## O que o time jurídico ainda precisa fechar

Ver `LGPD_AUDIT.md` seção Legal Review Items.

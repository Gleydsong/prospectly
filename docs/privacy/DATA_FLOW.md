# Data flow mapping

Última revisão técnica: 2026-08-28

## Conta do titular (SaaS user)

```
Titular
 → Web (formulário; checkbox termos default false)
 → API ValidationPipe (whitelist)
 → AuthService (Argon2 / Google token verify)
 → ConsentRecord (TERMS + PRIVACY)
 → PostgreSQL User + Organization + Membership
 → JWT + refresh cookie
 → e-mail (Resend/SMTP) só verificação / reset
 → AuditLog (sem senha)
```

Exportação: `GET /privacy/export` (JSON do titular, **sem** leads da org).  
Exclusão: `DELETE /privacy/account` anonimiza User, revoga tokens, remove memberships; **não** apaga CRM da org.

## Prospecção / leads (controlador = organização cliente)

```
Membro da org
 → OSM Nominatim/Overpass ou Google Places ou CSV
 → BullMQ job {searchId|importId} (sem PII no Redis)
 → Postgres SearchResult / stagedRows
 → LeadIngestionService
      → SuppressionService (hash e-mail/telefone/domínio)
      → Lead (+ soft-delete)
 → Campaign OPT_OUT → doNotContact + SuppressionEntry
 → Opportunity Finder JSON company (contacto na BD)
      → sanitizeCompanyForLlm → Ollama (sem e-mail/telefone/endereço)
```

Caminhos paralelos: CSV client-side na search page; export CSV de leads (OWNER, entitlement); logs de worker (IDs).

## Billing

```
OWNER/ADMIN
 → BillingProfile (cpfCnpj plaintext)
 → Asaas/Abacate (HTTPS)
 → BillingWebhookEvent.payload
```

Webhook Abacate: secret em header **ou** query (risco de access log). Stripe legado sem handler ativo.

## Fronteiras do sistema

| Fronteira | Dados | Controlo técnico |
| --- | --- | --- |
| Browser ↔ API | PII da sessão | CORS allowlist, JWT, HTTPS em prod |
| API ↔ Postgres | Tudo persistido | RLS + tenant guard |
| API ↔ Redis | IDs de job, throttle | Sem e-mail como chave |
| API ↔ OSM/Places | Queries geo + POIs | UA identificável; Places API key |
| API ↔ Ollama | Nome empresa, cidade, sinais | Sanitizer |
| API ↔ e-mail | E-mail do usuário | Tokens hashed |
| API ↔ gateways | Perfil pagador | Sem PAN |
| API ↔ logs host | req metadata | Pino redact |

## Backups

Snapshots Postgres no Render: **não** são expurgados pelo job de retenção. Pedido de exclusão vs backup = **LEGAL_REVIEW_REQUIRED** + runbook de restore.

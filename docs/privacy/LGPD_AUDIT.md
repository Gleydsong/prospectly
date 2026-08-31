# Auditoria LGPD — Prospectly

Data: 2026-08-28  
Âmbito: código neste repositório (`apps/api`, `apps/web`, `apps/landing`, infra Docker/Render/CI).  
**Não é parecer jurídico nem certificação de conformidade.**

## Sumário executivo

Prospectly é SaaS B2B multi-tenant de prospecção local. Já havia fundação sólida de segurança (Argon2, refresh HttpOnly, RLS, tenant guard, DNC parcial, DSR stub). A auditoria encontrou desalinhamento grave entre política (“exclusão”) e código (DSR marcava `COMPLETED` sem apagar), ausência de export real, retenção indefinida, CSV formula injection, e o tratamento de leads (possível PF/MEI) como área de alto risco jurídico.

Correções técnicas desta entrega reduzem a superfície de risco. A conformidade jurídica **depende** de DPO/advogado, RIPD, bases legais de prospecção e contratos com subprocessadores.

## Visão da arquitetura

Ver `SYSTEM_DATA_FLOW.md`. NestJS + Prisma + Postgres RLS + Redis/BullMQ + React + landing Next.js. IA via Ollama. Billing Abacate/Asaas.

## Inventário de dados pessoais

Ver `DATA_INVENTORY.md`.

## Fluxo de dados

Ver `DATA_FLOW.md`.

## Terceiros

Ver `THIRD_PARTY_PROCESSORS.md`.

## Análise de IA/LLM

Ollama local (configurável). Opportunity explanation e WhatsApp **não** enviam e-mail/telefone/endereço/senha. Camada `sanitizeCompanyForLlm` / `sanitizeLlmPayload` + testes. `AiRun` persiste metadados, não o prompt. Sem RAG/embeddings. Se `*_AI_BASE_URL` apontar para cloud: `EXTERNAL_REVIEW_REQUIRED`.

## Autenticação

JWT Bearer + refresh cookie HttpOnly; lockout 5/15min; rotação refresh; Argon2; Google GIS; reset token na **query string** (risco residual). Contas anonimizadas não autenticam.

## Autorização / multi-tenant

`organizationId` só do JWT. RLS FORCE + Prisma guard. Cross-tenant → 404. Testes RLS no CI. Suppression/Consent cobertos no guard/policies.

## Logs / analytics

Pino redact compartilhado. Sem GA/PostHog/replay. Sentry stub sem SDK/`beforeSend`.

## Retenção / exclusão / consentimento / cookies / direitos

Ver `DATA_RETENTION_POLICY.md`, `PRIVACY_ENGINEERING.md`. Cookies: só essenciais; analytics off.

## Segurança / infraestrutura

Helmet + HSTS em produção, CORS allowlist, throttle Redis, secret-scan heurístico no CI, `pnpm audit`. Render Postgres/Redis. Backups: dashboard Render.

## Resposta a incidentes

`docs/security/INCIDENT_RESPONSE.md`.

## Achados

### LGPD-001 — DSR COMPLETED sem erasure
**Severity:** HIGH  
**Category:** Data Subject Rights  
**Location:** `users.service.ts` (antigo stub)  
**Problem:** Approve marcava COMPLETED com nota de stub.  
**Impact:** Titular e política acreditavam em exclusão inexistente.  
**Status:** FIXED — DELETE chama `AccountErasureService`; EXPORT aponta para `/privacy/export`.

### LGPD-002 — Sem export JSON do titular
**Severity:** HIGH  
**Category:** Portability  
**Status:** FIXED — `GET /privacy/export` (sem leads de outros / da org como CRM).

### LGPD-003 — Reimport após opt-out
**Severity:** HIGH  
**Category:** Prospecting  
**Status:** FIXED — `SuppressionEntry` hashed + ingestão bloqueia.

### LGPD-004 — CSV formula injection
**Severity:** HIGH  
**Category:** Export security  
**Location:** `leads.service.ts`, `search-page.tsx`  
**Status:** FIXED — prefixo `'` em `=+-@`.

### LGPD-005 — Logs sem redact de cpfCnpj / query secrets
**Severity:** HIGH  
**Category:** Logging  
**Status:** FIXED — `PINO_REDACT_PATHS`.

### LGPD-006 — Versão de termos divergente
**Severity:** MEDIUM  
**Status:** FIXED — `TERMS_VERSION` / `PRIVACY_POLICY_VERSION` = `2026-08-17`.

### LGPD-007 — Política citava DELETE /me fase 2
**Severity:** HIGH  
**Category:** Transparency  
**Status:** FIXED — páginas PT/EN descrevem rotas reais.

### LGPD-008 — Sanitizer LLM não centralizado
**Severity:** MEDIUM  
**Status:** FIXED — módulo + testes sentinela.

### LGPD-009 — Consentimento só flags no User
**Severity:** MEDIUM  
**Status:** FIXED — `ConsentRecord` + API grant/withdraw.

### LGPD-010 — Retenção indefinida
**Severity:** MEDIUM  
**Status:** PARTIALLY_FIXED — job tokens + ImportError.data. Audit/waitlist/leads/billing: OPEN + LEGAL_REVIEW.

### LGPD-011 — Banner de cookies
**Severity:** LOW  
**Status:** PARTIALLY_FIXED — persistência versionada, só essenciais, link política. Sem analytics para bloquear.

### LGPD-012 — CPF/CNPJ em claro
**Severity:** HIGH  
**Location:** `BillingProfile`  
**Status:** OPEN — API OWNER/ADMIN; não cifrado em app. LEGAL_REVIEW + possível cifrar.

### LGPD-013 — Token de reset na query string
**Severity:** MEDIUM  
**Status:** OPEN — hash na BD; vazamento via Referer/logs de proxy.

### LGPD-014 — Webhook Abacate secret na query
**Severity:** MEDIUM  
**Status:** OPEN — preferir header; não remover fallback sem coordenar vendor.

### LGPD-015 — Access JWT em JS
**Severity:** MEDIUM  
**Status:** OPEN (aceite SEC-001) — XSS = roubo de access. Refresh HttpOnly.

### LGPD-016 — Soft-delete de lead
**Severity:** HIGH (privacy)  
**Status:** OPEN — unique keys retêm identidade. Não equivalente a erasure do titular-lead.

### LGPD-017 — Sem canal do titular-lead
**Severity:** HIGH  
**Status:** OPEN / LEGAL_REVIEW — só OPT_OUT interno.

### LGPD-018 — Transferência internacional
**Severity:** HIGH  
**Status:** LEGAL_REVIEW_REQUIRED

### LGPD-019 — RIPD prospecção/scoring/IA
**Severity:** HIGH  
**Status:** LEGAL_REVIEW_REQUIRED — ver `RIPD_PREASSESSMENT.md`

### LGPD-020 — Sentry
**Severity:** LOW  
**Status:** OPEN — stub; ligar SDK só com beforeSend.

### LGPD-021 — Waitlist sem prazo
**Severity:** MEDIUM  
**Status:** OPEN / LEGAL_REVIEW

### LGPD-022 — AuditLog sem expurgo
**Severity:** MEDIUM  
**Status:** LEGAL_REVIEW_REQUIRED

### LGPD-023 — Backups vs exclusão
**Severity:** MEDIUM  
**Status:** LEGAL_REVIEW_REQUIRED

### LGPD-024 — Last OWNER
**Severity:** INFO  
**Status:** FIXED (controlo) — 409 `LAST_OWNER_CANNOT_SELF_DELETE`. Org CRM não some no self-delete (correto para operador).

### LGPD-025 — Tenant escape
**Severity:** CRITICAL se existisse  
**Status:** Verificado existente (RLS+CI). Sem regressão intencional.

## Matriz de risco

| ID | Sev | Status |
| --- | --- | --- |
| 001–009, 024 | HIGH/MED | FIXED |
| 010–011 | MED/LOW | PARTIALLY_FIXED |
| 012–017, 020–021 | HIGH/MED/LOW | OPEN |
| 018–019, 022–023 | HIGH/MED | LEGAL_REVIEW_REQUIRED |
| 025 | CRITICAL (hipótese) | controlado |

## Itens de revisão jurídica

1. Base legal de prospecção (LI vs consentimento) e RIPD.
2. Papel operador vs controlador na política e contrato com clientes.
3. Transferências internacionais (Render/Google).
4. Retenção fiscal de billing e CPF.
5. DPO/encarregado e prazos ANPD.
6. Opt-out público para titulares de leads.
7. Menores.
8. Backups e direito ao esquecimento.
9. DPA subprocessadores.
10. Alinhamento contínuo política ↔ produto (Asaas, Ollama, Places).

## Correções implementadas

Ver `REMEDIATION_REPORT.md`.

## Riscos restantes

Prospecção de contactos, CPF em claro, tokens em URL, webhooks em query, retenção de leads/audit/waitlist, backups, transferência internacional, RIPD.

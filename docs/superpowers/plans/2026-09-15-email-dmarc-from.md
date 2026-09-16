# Email DMARC + From Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop sending as `no-reply@` and document the DNS records Gmail requires for DMARC/SPF on `prospectlyonboard.com`.

**Architecture:** Change the configured From string in env examples, config fallbacks, and unit tests. DNS and Render dashboard values are human-only; `render.yaml` stays `sync: false`.

**Tech Stack:** NestJS ConfigService, Resend, Vitest/Jest, Render env.

**Spec:** `docs/superpowers/specs/2026-09-15-email-dmarc-from-design.md`

## Global Constraints

- Canonical From: `Prospectly <hello@prospectlyonboard.com>`.
- Do not add DNS from CI. Do not commit secrets.
- Zero commit/push/merge unless Luna is asked. Programador does not git commit.
- Worktree: `/Users/guidev/orca/workspaces/prospectly/email-dmarc-from` branch `feat/email-dmarc-from`.
- Do not restage `.maestri/`.

---

### Task 1: Tests + From string

**Files:**
- Modify: `apps/api/src/common/mail/mail.service.spec.ts`
- Modify: `apps/api/src/common/mail/mail.service.ts` (fallback only if tests require it)
- Modify: `apps/api/src/config/configuration.ts`
- Modify: `apps/api/.env.example`
- Modify: `docs/superpowers/specs/2026-07-25-go-live-env-config-spec.md` (A20 example)

**Interfaces:**
- Produces: `resend.from` / `smtp.from` fallbacks without `no-reply`.
- Consumes: `RESEND_FROM`, `SMTP_FROM`.

- [ ] **Step 1:** In `mail.service.spec.ts`, change the Resend `from` fixture to `Prospectly <hello@prospectlyonboard.com>` and assert `sendMock` was called with that `from` (today the test only checks subject/html/tags). RED if the assertion is added before the fixture change; GREEN after.

- [ ] **Step 2:** Grep `no-reply@` under `apps/api` (ts + `.env.example`). Replace remaining product defaults with `hello@prospectlyonboard.com` (display name `Prospectly` where the current string already has it). Leave unrelated comments.

- [ ] **Step 3:** Update A20 example in the go-live spec from `no-reply@dominio.com` to `hello@dominio.com` (or the canonical onboard address).

- [ ] **Step 4:** Run `pnpm --filter @prospectly/api test -- src/common/mail/mail.service.spec.ts`. Expected: PASS.

- [ ] **Step 5:** Confirm `render.yaml` still has `RESEND_FROM` / `SMTP_FROM` with `sync: false` (no plaintext From in yaml).

---

### Task 2: Human DNS + Render (não é código)

Não implementar. Deixar no PR body:

**Namecheap DNS (apex `prospectlyonboard.com`):**

1. TXT `_dmarc` = `v=DMARC1; p=none; rua=mailto:hello@prospectlyonboard.com`
2. TXT `@` adicional = `v=spf1 include:amazonses.com ~all` (não apagar Google site verification)

**Render (API + worker):** `RESEND_FROM` e `SMTP_FROM` = `Prospectly <hello@prospectlyonboard.com>`

**Verify:** `dig +short TXT _dmarc.prospectlyonboard.com` e um envio real.

---

## Self-review

- Spec coverage: From sem no-reply no repo; DNS documentado; Render env documentado.
- No placeholders.
- Name: `hello@prospectlyonboard.com` everywhere for onboard (not `support@`, not `mail@`).

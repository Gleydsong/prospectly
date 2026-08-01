# Campaign guardrails (auto-send prerequisites)

> Status: Phase 3.1 ships **assisted cadences only**. Automatic outreach must remain disabled until every item below is implemented and reviewed.

## Current mode

- Templates support safe variable preview (`{{companyName}}`, etc.).
- Stages become **manual tasks** (e-mail, call, WhatsApp, LinkedIn).
- No provider sends messages from Prospectly.
- API responses for stage task creation include `autoSend: false`.

## Required before enabling auto-send

1. **Suppression list**
   - Block by e-mail, domain and phone at tenant scope.
   - Honor `Lead.doNotContact` and global suppressions before any enqueue.

2. **Opt-out**
   - One-click unsubscribe / stop link in every outbound message.
   - Immediate effect; no batch delay before suppression.

3. **Rate limits**
   - Caps per user, per domain and per organization (tenant).
   - Burst protection and quiet hours from campaign contact windows.

4. **Human approval**
   - First automatic campaigns require explicit approval by OWNER/ADMIN.
   - Keep an assisted fallback path.

5. **Audit & legal basis**
   - Log message id, template version, purpose, legal basis, actor and recipient hash.
   - Do **not** store full message bodies with unnecessary PII in audit metadata.

6. **Idempotency**
   - Deduplicate sends by `(campaignId, leadId, stageId, templateVersion)`.
   - Safe job reprocessing via outbox / unique provider keys.

7. **Consent & LGPD**
   - Confirm collection purpose and retention align with `docs/saas-mvp/lgpd-checklist.md`.
   - Skip leads without required consent when the channel demands it.

## Explicit non-goals for Phase 3.1

- SMTP/API providers wired for prospecting blasts
- A/B testing
- Webhook-triggered auto follow-ups
- Background workers that call e-mail or WhatsApp APIs for campaigns

## Rollout checklist

- [ ] Suppression list CRUD + enforcement tests
- [ ] Opt-out endpoint + landing confirmation
- [ ] Per-tenant / per-domain / per-user limits
- [ ] Approval workflow
- [ ] Message audit without secret leakage
- [ ] Idempotent send jobs
- [ ] Feature flag `CAMPAIGN_AUTO_SEND_ENABLED=false` by default

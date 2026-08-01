# Campaigns infrastructure

Phase 3.1 is assisted-only. Persistence uses Prisma models (`Campaign`, `CampaignLead`, `MessageTemplate`).

Future auto-send workers, provider adapters and outbox publishers belong here — only after guardrails in `docs/saas-mvp/campaign-guardrails.md` are satisfied.

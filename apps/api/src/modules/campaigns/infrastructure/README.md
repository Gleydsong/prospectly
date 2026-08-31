# Infraestrutura de campanhas

A Fase 3.1 é somente assistida. A persistência usa models Prisma (`Campaign`, `CampaignLead`, `MessageTemplate`).

Workers de envio automático, adapters de provedor e publishers de outbox pertencem aqui — só depois que os guardrails em `docs/saas-mvp/campaign-guardrails.md` estiverem satisfeitos.

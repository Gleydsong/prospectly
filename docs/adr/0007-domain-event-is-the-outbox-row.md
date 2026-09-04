---
status: accepted
---

# DomainEvent é a linha de OutboxEvent

AuditLog permanece compliance best-effort e redigido. LeadActivity e CampaignActivity permanecem timeline de produto. BillingWebhookEvent permanece inbox inbound de pagamento, sem organizationId. O fato de domínio recuperável é `OutboxEvent`: a mudança de negócio e o evento nascem na mesma transação PostgreSQL, Redis só acorda o worker, e o consumidor reclama a linha. Webhooks de tenant ficam para a Release 7.

## Opções consideradas

- Reusar AuditLog foi rejeitado: fire-and-forget, metadata redigida, sem contrato de entrega.
- Reusar LeadActivity foi rejeitado: timeline de UX, sem claim/retry/dead-letter.
- Duas tabelas DomainEvent + Outbox foi rejeitado neste corte: duplicaria o fato e o estado de entrega sem ganho para o primeiro writer (`lead.stage_changed`).

# Events

O contexto de Events registra fatos duráveis do domínio comercial da organização e o estado de entrega desses fatos.

## Language

**DomainEvent**:
O fato de negócio que já aconteceu, identificado, versionado e pertencente a uma organização. No Prospectly o DomainEvent vive na linha de OutboxEvent.
_Avoid_: AuditLog, LeadActivity, mensagem de fila, webhook inbound

**OutboxEvent**:
A linha PostgreSQL que guarda o DomainEvent e o estado de publicação (PENDING, PROCESSING, PROCESSED, FAILED, DEAD).
_Avoid_: Inbox, BillingWebhookEvent, job Redis

**Aggregate**:
A entidade de negócio à qual o fato se refere. Hoje o writer usa o Lead (`lead.stage_changed`, `lead.created`, `lead.do_not_contact_set`).
_Avoid_: Tabela, modelo Prisma, documento

**IdempotencyKey**:
A chave única por organização que torna seguro reprocessar o mesmo fato.
_Avoid_: jobId, correlationId

**Dead-letter**:
O estado DEAD depois do limite de tentativas, quando o fato permanece persistido sem novo dispatch automático.
_Avoid_: delete, drop, retry infinito

# Padrão outbox (Prospectly)

As escritas de domínio que geram DomainEvents nunca devem bloquear a UX. Use um **outbox** para o fato ficar local e o processamento ser eventually consistent.

## Fluxo

1. **Na mesma transação de DB** da mudança de negócio (ex.: atualização de estágio do lead): inserir uma linha `OutboxEvent` (`id`, `organizationId`, `type`, `payload`, `idempotencyKey`, `status=PENDING`).
2. O **worker** reclama a linha (`PENDING`/`FAILED`/PROCESSING stale), valida o payload e marca `PROCESSED` (ou `FAILED` com retry/backoff). Deduplicar com `idempotencyKey` para o reprocessamento ser seguro.
3. Handlers HTTP só enfileiram; eles **não** fazem `await` de trabalho de terceiros.

## Por quê

- Protege latência e disponibilidade da escrita comercial.
- Dá uma superfície clara de retry sem duplicar o fato (idempotência).
- Mantém payloads completos fora do AuditLog.

## Stub atual do MVP

`lead.stage_changed`, `lead.created`, `lead.do_not_contact_set` e `task.completed` já persistem `OutboxEvent` na mesma transação da escrita de domínio. O worker reclama a linha, Redis acorda o dispatch, valida o payload e marca `PROCESSED`. Fluxos consomem esses DomainEvents. Não há POST HTTP de tenant (Webhook de saída foi retirado).

# Padrão outbox de integração (Prospectly)

Sync de saída CRM/webhook nunca deve bloquear a UX do produto. Use um **outbox** para as escritas de domínio ficarem locais e a entrega ser eventually consistent.

## Fluxo

1. **Na mesma transação de DB** da mudança de negócio (ex.: atualização de estágio do lead): inserir uma linha `OutboxEvent` (`id`, `organizationId`, `type`, `payload`, `idempotencyKey`, `status=PENDING`).
2. O **worker** reclama a linha (`PENDING`/`FAILED`/PROCESSING stale), valida o payload e entrega via HTTP quando o webhook de saída do tenant está ativo.
3. Marcar `PROCESSED` (ou `FAILED` com retry/backoff). Deduplicar com `idempotencyKey` para o reprocessamento ser seguro.
4. Handlers HTTP só enfileiram; eles **não** fazem `await` da chamada de terceiro.

## Por quê

- Protege latência e disponibilidade quando HubSpot/Pipedrive/webhooks estão lentos ou fora.
- Dá uma superfície clara de retry sem envio duplo (idempotência).
- Mantém secrets e payloads completos fora do AuditLog; auditar só action + host + contagens.

## Stub atual do MVP

`lead.stage_changed`, `lead.created`, `lead.do_not_contact_set` e `task.completed` já persistem `OutboxEvent` na mesma transação da escrita de domínio. O worker reclama a linha, Redis acorda o dispatch e, quando existe `Integration` com `provider=WEBHOOK` e `status=ENABLED`, o worker faz `POST` JSON para a URL configurada (com proteção SSRF e DNS pinning).

Sem webhook ativo, o evento ainda é marcado `PROCESSED` após validação do payload.

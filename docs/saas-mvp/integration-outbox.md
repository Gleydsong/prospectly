# Padrão outbox de integração (Prospectly)

Sync de saída CRM/webhook nunca deve bloquear a UX do produto. Use um **outbox** para as escritas de domínio ficarem locais e a entrega ser eventually consistent.

## Fluxo

1. **Na mesma transação de DB** da mudança de negócio (ex.: atualização de estágio do lead): inserir uma linha `OutboxEvent` (`id`, `organizationId`, `type`, `payload`, `idempotencyKey`, `status=PENDING`).
2. O **worker** faz poll ou escuta (`FOR UPDATE SKIP LOCKED` / fila) e entrega no webhook/CRM configurado.
3. Marcar `PROCESSED` (ou `FAILED` com retry/backoff). Deduplicar com `idempotencyKey` para o reprocessamento ser seguro.
4. Handlers HTTP só enfileiram; eles **não** fazem `await` da chamada de terceiro.

## Por quê

- Protege latência e disponibilidade quando HubSpot/Pipedrive/webhooks estão lentos ou fora.
- Dá uma superfície clara de retry sem envio duplo (idempotência).
- Mantém secrets e payloads completos fora do AuditLog; auditar só action + host + contagens.

## Stub atual do MVP

`Integration` com `provider=WEBHOOK` guarda a URL de destino. Workers de entrega e uma tabela física `OutboxEvent` podem entrar numa fase posterior; até lá, trate este doc como o contrato de qualquer implementação de sync.

# Integrations

O contexto de Integrations liga a organização a um endpoint HTTP de saída, para receber DomainEvents já persistidos.

## Language

**Webhook de saída**:
A Integration da organização (`provider=WEBHOOK`): uma URL que recebe POST dos DomainEvents. Há no máximo um por organização.
_Avoid_: Conexão Google, Sign-In, webhook Asaas/Stripe/Abacate, PluginToken, Ferramentas, HubSpot

**Segredo de assinatura**:
O valor HMAC da organização, mostrado só na criação ou rotação. O GET nunca o devolve.
_Avoid_: PluginToken, GOOGLE_CLIENT_SECRET, senha da conta

**Assinatura**:
A prova HMAC no POST do Webhook de saída, para o receptor confiar que o Prospectly enviou o DomainEvent.
_Avoid_: PluginToken, cookie, OAuth, webhook secret de billing

**Rotação**:
Substituição do Segredo de assinatura; o valor anterior deixa de assinar na hora. Mudar a URL não é Rotação.
_Avoid_: refresh token, Ligar Google, revogar PluginToken

**Omissão**:
Entrega `PROCESSED` sem POST, quando o Webhook de saída está desligado ou sem URL. Não reenvia o passado ao ligar.
_Avoid_: FAILED, DEAD, fila PENDING, retry

**Entrega**:
O estado de publicação de um DomainEvent no Webhook de saída (`PENDING`, `PROCESSING`, `PROCESSED`, `FAILED`, `DEAD`).
_Avoid_: Inbox de webhook (billing), AuditLog, job Redis

## Assinatura (receptor)

Header `X-Prospectly-Signature: t=<unixSeconds>,v1=<hex>` sobre `{t}.{rawBody}` com HMAC-SHA256 e o Segredo de assinatura. Rejeitar replay com `|now - t| > 300` segundos no receptor. O Prospectly não recusa o próprio POST por skew.

Headers de evento: `X-Prospectly-Event-Id`, `X-Prospectly-Event-Type`. Body JSON `{ type, schemaVersion, eventId, organizationId, correlationId, occurredAt, data }`.

# Integrations

O contexto de Integrations liga a organização a consumidores externos via PluginToken.

## Language

**PluginToken**:
A chave da organização (`pst_…`) para um agente ou editor ler dados de prospecção pela API de plugin. Há várias por organização; cada uma pode ser revogada.
_Avoid_: Conexão Google, Sign-In, webhook Asaas/Stripe/Abacate, Ferramentas, HubSpot, Webhook de saída

**API de plugin**:
O endpoint autenticado pela chave (`x-prospectly-plugin-key`) que devolve resumo, clientes potenciais e buscas da organização, sem PII de contacto.
_Avoid_: REST autenticada por cookie da sessão, Ferramentas, DomainEvent

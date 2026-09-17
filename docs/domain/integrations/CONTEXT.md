# Integrations

O contexto de Integrations liga a organização a consumidores externos via PluginToken e Ligação MCP.

## Language

**PluginToken**:
A chave da organização (`pst_…`) para um agente ou editor ler dados de prospecção pela API de plugin. Há várias por organização; cada uma pode ser revogada.
_Avoid_: Conexão Google, Sign-In, Ligação MCP, webhook Asaas/Stripe/Abacate, Ferramentas, HubSpot, Webhook de saída

**API de plugin**:
O endpoint autenticado pela chave (`x-prospectly-plugin-key`) que devolve resumo, clientes potenciais e buscas da organização, sem PII de contacto.
_Avoid_: REST autenticada por cookie da sessão, Servidor MCP, Ferramentas, DomainEvent

**Ligação MCP**:
A autorização durável de um OWNER/ADMIN para um cliente MCP ler a API de plugin de uma organização. Uma ligação é uma organização; pode ser revogada.
_Avoid_: PluginToken, Conexão Google, Sign-In, Copiloto CRM, Agente (in-app)

**Servidor MCP**:
O recurso HTTP MCP da organização autenticado pelo access token da Ligação MCP. Expõe as mesmas leituras da API de plugin, sem PII de contacto.
_Avoid_: API autenticada por JWT da app, Copiloto CRM, Conexão Google

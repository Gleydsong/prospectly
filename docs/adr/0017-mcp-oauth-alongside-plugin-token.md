# MCP usa OAuth de terceiros; PluginToken permanece

A API de plugin já autentica editores com PluginToken (`pst_…`) por organização, sem PII de contacto. Agentes MCP (Cursor/Claude) exigem OAuth 2.1 + discovery, não uma chave colada para sempre. O Prospectly passa a ser Authorization Server para esses clientes, com Ligação MCP (consentimento OWNER/ADMIN, uma org). PluginToken e a rota HTTP de plugin ficam: Notion/curl não precisam de MCP. JWT da app e Conexão Google não autenticam o MCP — são sessão humana e mailbox pessoal.

## Opções consideradas

- Só PluginToken no header do MCP: rejeitado — o cliente pediu login + ceder ligação; Cursor espera 401 + OAuth.
- Matar PluginToken e forçar OAuth em tudo: rejeitado — a API de plugin e o ecrã de chaves já existem.
- Serviço MCP separado na Render: rejeitado no v1 — mesmo tenant, mesmo `extract()`, um processo Nest.
- Reusar JWT/refresh cookie da app no agente: rejeitado — cookie só em `/api/v1/auth`; mistura sessão web com cliente terceiro.

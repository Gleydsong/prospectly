# Mapa de contextos

## Contextos

- [Billing](./docs/domain/billing/CONTEXT.md): vende créditos e acesso mensal para organizações e mantém o histórico financeiro desses benefícios
- [Events](./docs/domain/events/CONTEXT.md): registra fatos duráveis do domínio comercial e o estado de entrega desses fatos
- [Views](./docs/domain/views/CONTEXT.md): guarda listas inteligentes da organização sobre clientes potenciais
- [Workflows](./docs/domain/workflows/CONTEXT.md): guarda Fluxos da organização que reagem a DomainEvents com definição allowlisted

## Relacionamentos

- **Billing → Organizations**: benefícios adquiridos pertencem a uma organização, independentemente da pessoa que realizou o pagamento
- **Billing → Usage**: o saldo adquirido financia o uso de funcionalidades cobradas por créditos
- **Events → Organizations**: cada DomainEvent pertence à organização da sessão; nunca chega `organizationId` do cliente
- **Events → Lead**: o writer persiste `lead.stage_changed`, `lead.created`, `lead.do_not_contact_set` e `task.completed`
- **Views → Organizations**: cada Vista salva pertence à organização da sessão
- **Views → Lead**: a definição da Vista é uma allowlist da listagem de clientes potenciais; não copia PII do Lead
- **Workflows → Organizations**: cada Fluxo pertence à organização da sessão
- **Workflows → Events**: o executor futuro consome DomainEvents já persistidos (`lead.created` no primeiro tracer)
- **Workflows → Views**: o filtro opcional do Fluxo reutiliza a AST allowlisted da Vista; não inventa um segundo motor

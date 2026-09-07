# Mapa de contextos

## Contextos

- [Billing](./docs/domain/billing/CONTEXT.md): vende créditos e acesso mensal para organizações e mantém o histórico financeiro desses benefícios
- [Events](./docs/domain/events/CONTEXT.md): registra fatos duráveis do domínio comercial e o estado de entrega desses fatos
- [Views](./docs/domain/views/CONTEXT.md): guarda listas inteligentes da organização sobre clientes potenciais
- [Workflows](./docs/domain/workflows/CONTEXT.md): guarda Fluxos da organização que reagem a DomainEvents com definição allowlisted
- [Reports](./docs/domain/reports/CONTEXT.md): lê DomainEvents da organização e mostra conversão do funil na janela rolling
- [Custom fields](./docs/domain/custom-fields/CONTEXT.md): guarda definições da organização de dados tipados no cliente potencial
- [Agents](./docs/domain/agents/CONTEXT.md): fornece copiloto CRM e variantes de abordagem WhatsApp assistidas
- [Communications](./docs/domain/communications/CONTEXT.md): associa e-mail e eventos de calendário da Conexão Google de uma pessoa ao cliente potencial

## Relacionamentos

- **Agents → Organizations**: sugestões e abordagens pertencem estritamente à organização da sessão
- **Agents → Leads**: avalia sinais técnicos (WebsiteAnalysis), dados de contato e DNC para sugerir ações e gerar mensagens
- **Agents → Pipelines**: o copiloto pode aplicar transição de estágio e registrar avanços após contato confirmado
- **Agents → Tasks**: inspeciona tarefas atrasadas e permite agendamento direto de follow-ups
- **Billing → Organizations**: benefícios adquiridos pertencem a uma organização, independentemente da pessoa que realizou o pagamento
- **Billing → Usage**: o saldo adquirido financia o uso de funcionalidades cobradas por créditos
- **Events → Organizations**: cada DomainEvent pertence à organização da sessão; nunca chega `organizationId` do cliente
- **Events → Lead**: o writer persiste `lead.stage_changed`, `lead.created`, `lead.do_not_contact_set` e `task.completed`
- **Views → Organizations**: cada Vista salva pertence à organização da sessão
- **Views → Lead**: a definição da Vista é uma allowlist da listagem de clientes potenciais; não copia PII do Lead
- **Workflows → Organizations**: cada Fluxo pertence à organização da sessão
- **Workflows → Events**: o executor consome DomainEvents já persistidos (`lead.created` no primeiro tracer)
- **Workflows → Views**: o filtro opcional do Fluxo reutiliza a AST allowlisted da Vista; não inventa um segundo motor
- **Reports → Organizations**: cada leitura pertence à organização da sessão; nunca chega `organizationId` do cliente
- **Reports → Events**: Relatórios agrega `OutboxEvent` (`lead.created`, `lead.stage_changed`); não cria DomainEvent
- **Reports → Pipeline**: Ganho/Perdido usa as flags atuais de `PipelineStage`, não o snapshot da Principal
- **Custom fields → Organizations**: cada definição pertence à organização da sessão
- **Custom fields → Lead**: o valor vive no JSONB do Lead; a definição não copia PII
- **Communications → Organizations**: cada Conexão Google e cada Comunicação sincronizada pertencem à organização da sessão
- **Communications → User**: a Conexão Google é da pessoa; não reutiliza Integration nem Sign-In
- **Communications → Lead**: a Comunicação sincronizada casa no cliente potencial; não é LeadActivity nem DomainEvent

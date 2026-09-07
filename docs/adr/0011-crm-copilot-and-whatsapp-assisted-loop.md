# 11. Copiloto CRM e Loop Assistido de WhatsApp

## Contexto

Os módulos de Agents (`crm` e `whatsapp-ai`) foram introduzidos como assistentes isolados em `/agents/*`. No entanto:
1. Vendedores operam primariamente dentro da lista de leads, no detalhe do lead e no quadro Kanban.
2. Abrir o WhatsApp via `wa.me` não gravava histórico no CRM (`LeadActivity`), não avançava o pipeline e não sugeria lembrete de follow-up.
3. O gerador de mensagens limitava-se à 1ª abordagem, ignorando que mais de 70% das conversões B2B ocorrem nos follow-ups subsequentes.
4. A riqueza das auditorias técnicas de websites (`WebsiteAnalysis`) não chegava aos geradores de copy, perdendo argumentos comerciais de alto impacto.
5. A mensagem de outreach rápida no detalhe do lead vazava ações internas do sistema como texto para o cliente.

## Decisão

1. **Loop Assistido de Contato (`recordOutreach`)**:
   - Mantemos o princípio inviolável de **nenhum disparo automático** (todo contato é acionado pelo operador humano via `wa.me`).
   - Ao confirmar o contato, a API executa em transação única: registro de `LeadActivity` (`type: WHATSAPP`), transição opcional de estágio no pipeline (com respectivo `OutboxEvent`) e agendamento opcional de tarefa de follow-up (`Task`).
2. **Sequências de Abordagem**:
   - Suporte aos estágios de sequência: `FIRST_MESSAGE`, `FOLLOW_UP_1`, `FOLLOW_UP_2` e `BREAKUP`.
3. **Consumo de Sinais de Auditoria de Website**:
   - Passar sinais estruturados (`hasWhatsapp`, `hasViewport`, `responseTimeMs`, `seoHealthScore`) para o contexto de IA e para os packs determinísticos, enriquecendo o ângulo `dor_site`.
4. **Copiloto CRM Integrado e Triagem Diária**:
   - `suggestCrm` expõe ações executáveis diretamente na UI (modal de WhatsApp, agendamento de tarefas e avanço de funil).
   - Introduzir `GET /api/v1/agents/crm/daily-focus` para priorizar os leads mais urgentes do dia.
5. **Sanitização da Mensagem de Contato Rápido**:
   - Corrigir `buildWhatsAppOutreachMessage` para nunca vazar ações internas do CRM no texto gerado.

## Consequências

- O fluxo de vendas ganha fechamento de ciclo (rastreabilidade, histórico e avanço de funil).
- Aumenta a taxa de resposta com follow-ups estruturados e argumentos baseados na auditoria técnica real do lead.
- Elimina navegação desnecessária entre páginas, permitindo abordagem direta no detalhe do lead.

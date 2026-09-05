---
status: accepted
---

# Relatórios lê OutboxEvent, não cubo nem snapshot

A Principal continua a resumir o estado atual do funil (`Lead.status`, `createdAt` no período). Relatórios responde a outra pergunta: o que aconteceu na janela, segundo DomainEvents já persistidos. Um cubo ou tabela de factos anteciparia drill-down, CSV e créditos sem tráfego medido. Relatórios consulta `OutboxEvent` (`lead.created`, `lead.stage_changed`) e as flags atuais de `PipelineStage`. DashboardService permanece o agregador da Principal.

## Opções consideradas

- Reusar `DashboardService` / snapshot de `Lead.status`: rejeitado — mistura cohort de criação com estado atual e não é o contrato de Relatórios.
- Cubo ou tabela de factos: rejeitado no v1 — YAGNI até haver drill-down persistido (#137) ou créditos no relatório.
- Congelar `isWon`/`isLost` no payload do evento: adiado — reclassificar etapa reescreve o passado neste corte.

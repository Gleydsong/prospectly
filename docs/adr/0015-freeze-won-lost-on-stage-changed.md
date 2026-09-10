---
status: accepted
---

# Congelar isWon/isLost no fato `lead.stage_changed` v2

Relatórios v1 classificam ganho/perda com as flags **actuais** da etapa. O OWNER marca «Proposta» como Ganho e os últimos 90 dias passam a contar mudanças antigas como conversão. A história comercial deixa de ser estável. O snapshot no DomainEvent (`toStageIsWon`/`toStageIsLost`, `schemaVersion` 2) fixa o significado no commit da transação. Eventos v1 continuam a seguir o agora — expand/contract, sem backfill.

## Opções consideradas

- Reescrever payloads v1 / job de backfill: rejeitado — migração destrutiva e inventaria um passado que o fato não gravou.
- Cubo ou tabela de factos: rejeitado — Relatórios já lê OutboxEvent (ADR 0009).
- Só flags actuais para sempre: rejeitado — o Relatório mente quando a etapa muda de significado.

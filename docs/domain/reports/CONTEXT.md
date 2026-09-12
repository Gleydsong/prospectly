# Reports

O contexto de Reports lê fatos duráveis já persistidos e mostra conversão do funil para a organização da sessão. Não guarda um Relatório persistido e não muta estado comercial.

## Language

**Relatórios**:
A área de produto que agrega DomainEvents da organização numa janela rolling. Não é a Principal, a Vista, o Fluxo nem a Cadência.
_Avoid_: Dashboard, SavedView, Workflow, Campaign, cubo OLAP

**Conversão do funil**:
Contagem de `leadId` distintos que, na janela, tiveram `lead.stage_changed` classificado como ganho ou perda. Eventos `schemaVersion` ≥ 2 usam `toStageIsWon`/`toStageIsLost` congelados no fato. Eventos v1 usam `PipelineStage.isWon`/`isLost` **agora**.
_Avoid_: snapshot de `Lead.status`, taxa da Principal (`won / (won + lost)` com `createdAt` no período)

**Entrada**:
`lead.created` na janela. KPI à parte; não entra no denominador da taxa de ganho.
_Avoid_: primeira etapa do funil, importação sem evento

**Balde**:
O conjunto de `leadId` distintos por métrica (entradas, ganhos ou perdas), opcionalmente restrito a uma origem, na mesma janela e filtros do Relatório.
_Avoid_: Vista salva, CSV, funil etapa-a-etapa

## Invariants

- Fonte: `OutboxEvent`. Relatórios não lê `DashboardService` nem o status atual do Lead para ganho/perda.
- Períodos: `7d`, `30d`, `90d` rolling. Não há `all`. O copy de retenção segue `OUTBOX_RETAIN_DAYS` (90).
- Taxa = ganhos distintos / união (ganhou ou perdeu pelo menos uma vez). Lead que ganhou e perdeu: wins=1, losses=1, union=1, winRate=100.
- `organizationId` só da sessão. VIEWER lê. Filtro de dono é opcional; SALES pode abrir já filtrado em si.
- `doNotContact` não apaga ganho/perda já ocorridos. Lead apagado (`deletedAt`) não entra.
- Reclassificar `isWon`/`isLost` só reescreve eventos v1. Eventos v2 mantêm o snapshot do fato. Sem backfill.
- Clique num balde (entradas, ganhos, perdas, ou célula de origem) abre Clientes com os mesmos `leadId` distintos; não grava Vista. Balde vazio não navega.

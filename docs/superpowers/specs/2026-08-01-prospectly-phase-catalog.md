# Prospectly — catálogo de fases do workflow

> Fonte: [2026-08-01-prospectly-improvement-workflow-for-cursor.md](./2026-08-01-prospectly-improvement-workflow-for-cursor.md)  
> **HTML (navegável):** [../reports/2026-08-01-prospectly-phase-catalog.html](../reports/2026-08-01-prospectly-phase-catalog.html)  
> Atualizado: **2026-08-01** (sessão completa)  
> Regra: **uma fase/subitem por branch/PR**. Não misturar segurança, feature comercial e infra no mesmo diff.

## Legenda de status

| Status | Significado |
|--------|-------------|
| `done_pr_open` | Implementado; PR aberto, aguardando merge |
| `done_merged` | Implementado e mergeado em `main` |
| `in_progress` | Em implementação agora |
| `next` | Próximo item da ordem sugerida |
| `todo` | Ainda não iniciado |
| `blocked` | Depende de aprovação ou pré-requisito |
| `audited` | Analisado; gaps documentados; código ainda não feito |

---

## Resumo executivo

| # | Fase / subitem | Status | Branch / PR |
|---|----------------|--------|-------------|
| 1 | **0.1** Recuperação de senha | `done_pr_open` | [PR #12](https://github.com/Gleydsong/prospecting/pull/12) |
| 2 | **0.2** CI verde | `done_pr_open` | [PR #13](https://github.com/Gleydsong/prospecting/pull/13) |
| 3 | **0.3** Advisories high + CI | `done_pr_open` | [PR #15](https://github.com/Gleydsong/prospecting/pull/15) |
| 4 | **0.4** Imagem prod + migrations | `done_pr_open` / `blocked` (Render) | [PR #16](https://github.com/Gleydsong/prospecting/pull/16) |
| 5 | **1.1** Lazy routes + error boundary | `done_pr_open` | [PR #17](https://github.com/Gleydsong/prospecting/pull/17) |
| 6 | **1.2** Pipeline a11y + paginação | `done_pr_open` | [PR #25](https://github.com/Gleydsong/prospecting/pull/25) |
| 7 | **1.3** Métricas operacionais | `done_pr_open` | [PR #18](https://github.com/Gleydsong/prospecting/pull/18) |
| 8 | **2.1–2.2** Proveniência + enrichment | `done_pr_open` | [PR #19](https://github.com/Gleydsong/prospecting/pull/19) |
| 9 | **2.3** Score explicável | `done_pr_open` | [PR #20](https://github.com/Gleydsong/prospecting/pull/20) |
| 10 | **3.1** Cadências assistidas | `done_pr_open` | [PR #21](https://github.com/Gleydsong/prospecting/pull/21) |
| 11 | **3.2** Integrações / export | `done_pr_open` | [PR #24](https://github.com/Gleydsong/prospecting/pull/24) |
| 12 | **3.3** Painel de decisão | `done_pr_open` | [PR #24](https://github.com/Gleydsong/prospecting/pull/24) (com 3.2) |
| 13 | **4.1–4.2** Audit + titulares | `done_pr_open` | [PR #23](https://github.com/Gleydsong/prospecting/pull/23) |
| 14 | **5** Split API / workers | `done_pr_open` / `blocked` (aprovação) | [PR #22](https://github.com/Gleydsong/prospecting/pull/22) |
| — | Catálogo docs | `done_pr_open` | [PR #14](https://github.com/Gleydsong/prospecting/pull/14) |

**Progresso:** todos os subitens do workflow têm PR aberto (#12–#25, exceto bugfix drafts).  
**Pendente:** merge ordenado em `main` + sync.

**Ordem de merge sugerida:** #12 → #13 → #14 → #15 → #16 → #17 → #25 → #18 → #19 → #20 → #21 → #24 → #23 → #22.

---

## Fase 0 — liberar uma entrega segura

### 0.1 Recuperação de senha — `done_pr_open`

| Campo | Valor |
|-------|--------|
| PR | https://github.com/Gleydsong/prospecting/pull/12 |
| Branch | `codex/0.1-password-reset-email` |
| Checklist | [validation HTML](../reports/2026-08-01-fase-0.1-password-reset-validation.html) |

### 0.2 CI verde — `done_pr_open`

| Campo | Valor |
|-------|--------|
| PR | https://github.com/Gleydsong/prospecting/pull/13 |
| Branch | `codex/0.2-restore-ci-coverage` |

### 0.3 Advisories runtime — `done_pr_open`

| Campo | Valor |
|-------|--------|
| PR | https://github.com/Gleydsong/prospecting/pull/15 |
| Branch | `codex/0.3-runtime-high-advisories` |
| Nota | `scripts/audit-runtime.cjs` + `docs/security/audit-exceptions.md`; CI falha em high de runtime |

### 0.4 Imagem prod + migrations — `done_pr_open` / `blocked`

| Campo | Valor |
|-------|--------|
| PR | https://github.com/Gleydsong/prospecting/pull/16 |
| Branch | `codex/0.4-prod-image-migrations` |
| Bloqueio | alteração efetiva de `render.yaml` exige aprovação |

---

## Fase 1 — experiência, desempenho e observabilidade

### 1.1 Lazy routes + error boundary — `done_pr_open`

| PR | https://github.com/Gleydsong/prospecting/pull/17 · `codex/1.1-lazy-routes-error-boundary` |

### 1.2 Pipeline a11y + paginação — `done_pr_open`

| PR | https://github.com/Gleydsong/prospecting/pull/25 · `codex/1.2-pipeline-a11y-pagination` |

**Entregue:** Mover para etapa (teclado), `aria-live`, `totalCount`/`hasMore`, `GET /pipelines/stages/:id/leads`, testes API + web.

### 1.3 Métricas operacionais — `done_pr_open`

| PR | https://github.com/Gleydsong/prospecting/pull/18 · `codex/1.3-ops-metrics-runbooks` |

---

## Fase 2 — qualidade de dados e priorização

### 2.1–2.2 Proveniência + enrichment — `done_pr_open`

| PR | https://github.com/Gleydsong/prospecting/pull/19 · `codex/2.1-lead-provenance` |

### 2.3 Score explicável — `done_pr_open`

| PR | https://github.com/Gleydsong/prospecting/pull/20 · `codex/2.3-explainable-scoring` |

---

## Fase 3 — ciclo comercial

### 3.1 Cadências assistidas — `done_pr_open`

| PR | https://github.com/Gleydsong/prospecting/pull/21 · `codex/3.1-assisted-campaigns` |

### 3.2–3.3 Export + dashboard — `done_pr_open`

| PR | https://github.com/Gleydsong/prospecting/pull/24 · `codex/3.2-3.3-export-dashboard` |

**Entregue:** export CSV + audit; webhook stub + doc outbox; dashboard com filtros e métricas de decisão.

**Riscos:** outbox físico ainda documentado (sem worker); filtro de campanha e timing por estágio omitidos.

---

## Fase 4 — privacidade, auditoria e confiança — `done_pr_open`

| PR | https://github.com/Gleydsong/prospecting/pull/23 · `codex/4-compliance-audit` |

**Entregue:** `AuditService` com redaction; hooks em estágio/import/org; workflow OWNER de `DataSubjectRequest`; migration.

---

## Fase 5 — separar API e workers — `done_pr_open` / `blocked`

| PR | https://github.com/Gleydsong/prospecting/pull/22 · `codex/5-bullmq-workers` |

**Bloqueio residual:** ativação no Render / evidência de métricas.

---

## Fora do workflow (não mergear neste lote)

PRs draft `cursor/critical-bug-management-*` (#1, #4, #6–#11) — manter separados até pedido explícito.

---

## Histórico

| Data | Evento |
|------|--------|
| 2026-08-01 | Catálogo inicial (PRs #12–#14). |
| 2026-08-01 | Sessão completa: PRs #15–#25 abertos (0.3→5 + 1.2 + 3.2/3.3). Aguardando merge ordenado em `main`. |

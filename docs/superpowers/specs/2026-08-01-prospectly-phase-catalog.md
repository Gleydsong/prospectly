# Prospectly — catálogo de fases do workflow

> Fonte: [2026-08-01-prospectly-improvement-workflow-for-cursor.md](./2026-08-01-prospectly-improvement-workflow-for-cursor.md)  
> **HTML (navegável):** [../reports/2026-08-01-prospectly-phase-catalog.html](../reports/2026-08-01-prospectly-phase-catalog.html)  
> Atualizado: **2026-08-01** (merge completo em `main`)  
> Regra: **uma fase/subitem por branch/PR**. Não misturar segurança, feature comercial e infra no mesmo diff.

## Legenda de status

| Status | Significado |
|--------|-------------|
| `done_pr_open` | Implementado; PR aberto, aguardando merge |
| `done_merged` | Implementado e mergeado em `main` |
| `blocked` | Depende de aprovação operacional restante |
| `todo` | Ainda não iniciado |

---

## Resumo executivo

| # | Fase / subitem | Status | PR |
|---|----------------|--------|-----|
| 1 | **0.1** Recuperação de senha | `done_merged` | [#12](https://github.com/Gleydsong/prospecting/pull/12) |
| 2 | **0.2** CI verde | `done_merged` | [#13](https://github.com/Gleydsong/prospecting/pull/13) |
| 3 | **0.3** Advisories high + CI | `done_merged` | [#15](https://github.com/Gleydsong/prospecting/pull/15) |
| 4 | **0.4** Imagem prod + migrations | `done_merged` / `blocked` (Render) | [#16](https://github.com/Gleydsong/prospecting/pull/16) |
| 5 | **1.1** Lazy routes + error boundary | `done_merged` | [#17](https://github.com/Gleydsong/prospecting/pull/17) |
| 6 | **1.2** Pipeline a11y + paginação | `done_merged` | [#25](https://github.com/Gleydsong/prospecting/pull/25) |
| 7 | **1.3** Métricas operacionais | `done_merged` | [#18](https://github.com/Gleydsong/prospecting/pull/18) |
| 8 | **2.1–2.2** Proveniência + enrichment | `done_merged` | [#19](https://github.com/Gleydsong/prospecting/pull/19) |
| 9 | **2.3** Score explicável | `done_merged` | [#20](https://github.com/Gleydsong/prospecting/pull/20) |
| 10 | **3.1** Cadências assistidas | `done_merged` | [#21](https://github.com/Gleydsong/prospecting/pull/21) |
| 11 | **3.2–3.3** Export + dashboard | `done_merged` | [#24](https://github.com/Gleydsong/prospecting/pull/24) |
| 12 | **4.1–4.2** Audit + titulares | `done_merged` | [#23](https://github.com/Gleydsong/prospecting/pull/23) |
| 13 | **5** Split API / workers | `done_merged` / `blocked` (Render) | [#22](https://github.com/Gleydsong/prospecting/pull/22) |
| — | Catálogo docs | `done_merged` | [#14](https://github.com/Gleydsong/prospecting/pull/14) |

**Progresso:** 14/14 PRs do workflow mergeados em `main` (2026-08-01).  
**HEAD local:** sincronizado com `origin/main`.

**Pendências operacionais (não de código):**
- Aprovar/aplicar alterações de `render.yaml` (migration job + worker service) — ver `docs/deploy/migrations.md` e `docs/deploy/workers.md`.
- Outbox físico de integrações ainda documentado (sem worker de entrega).

---

## Ordem de merge executada

`#12 → #13 → #14 → #15 → #16 → #17 → #25 → #18 → #19 → #20 → #21 → #24 → #23 → #22`

Conflitos resolvidos em commits de merge em `main` quando necessário (#13, #17, #20, #21, #24, #22).

---

## Fora do workflow

Drafts `cursor/critical-bug-management-*` (#1, #4, #6–#11) **não** foram mergeados.

---

## Histórico

| Data | Evento |
|------|--------|
| 2026-08-01 | Catálogo inicial (PRs #12–#14). |
| 2026-08-01 | PRs #15–#25 abertos. |
| 2026-08-01 | **Merge completo** dos PRs #12–#25 em `main`. |

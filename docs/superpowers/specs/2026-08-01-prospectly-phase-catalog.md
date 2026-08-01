# Prospectly — catálogo de fases do workflow

> Fonte: [2026-08-01-prospectly-improvement-workflow-for-cursor.md](./2026-08-01-prospectly-improvement-workflow-for-cursor.md)  
> **HTML (navegável):** [../reports/2026-08-01-prospectly-phase-catalog.html](../reports/2026-08-01-prospectly-phase-catalog.html)  
> Atualizado: **2026-08-01**  
> Regra: **uma fase/subitem por branch/PR**. Não misturar segurança, feature comercial e infra no mesmo diff.

## Legenda de status

| Status | Significado |
|--------|-------------|
| `done_pr_open` | Implementado nesta sessão; PR aberto, aguardando merge |
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
| 1 | **0.1** Recuperação de senha | `done_pr_open` | [`codex/0.1-password-reset-email`](https://github.com/Gleydsong/prospecting/pull/12) · PR **#12** |
| 2 | **0.2** CI verde | `done_pr_open` | [`codex/0.2-restore-ci-coverage`](https://github.com/Gleydsong/prospecting/pull/13) · PR **#13** |
| 3 | **0.3** Advisories high + CI | `next` | — |
| 4 | **0.4** Imagem prod + migrations | `todo` / `blocked` (aprovação Render) | — |
| 5 | **1.1** Lazy routes + error boundary | `todo` | — |
| 6 | **1.2** Pipeline a11y + paginação | `todo` | — |
| 7 | **1.3** Métricas operacionais | `todo` | — |
| 8 | **2.1–2.2** Proveniência + enrichment | `audited` | gaps mapeados em 2026-08-01 |
| 9 | **2.3** Score explicável | `audited` | limite silencioso `take: 5000` |
| 10 | **3.1** Cadências assistidas | `todo` | Prisma existe; sem módulo/UI |
| 11 | **3.2** Integrações / export | `todo` | — |
| 12 | **3.3** Painel de decisão | `todo` | — |
| 13 | **4.1** Audit log em uso | `todo` | modelo existe; não grava |
| 14 | **4.2** Titulares / retenção | `todo` | — |
| 15 | **5** Split API / workers | `todo` / `blocked` (métricas + aprovação) | — |

**Progresso Fase 0:** 2/4 subitens implementados (PRs abertos).  
**Progresso geral (subitens do catálogo):** 2 feitos · 1 próximo · 1 auditado (Fase 2) · restante pendente.

---

## Fase 0 — liberar uma entrega segura

### 0.1 Recuperação de senha funcional — `done_pr_open`

| Campo | Valor |
|-------|--------|
| PR sugerido | `fix(auth): deliver password reset emails safely` |
| Branch | `codex/0.1-password-reset-email` |
| PR | https://github.com/Gleydsong/prospecting/pull/12 |
| Commit | `1f627c7` |
| Checklist | [validation HTML](../reports/2026-08-01-fase-0.1-password-reset-validation.html) |

**Entregue:**
- Template de e-mail PT/EN + envio via `MailService`
- Falha observável em prod/staging sem provider (anti-enumeração)
- Páginas `/forgot-password` e `/reset-password` + link no login
- Testes API (envio, enumeração, expirado, reuse) e Web
- Invalidação de sessões no reset (já existia; coberta por testes)

**Pendente de merge:** review + merge do PR #12 em `main`.

---

### 0.2 Restaurar CI verde — `done_pr_open`

| Campo | Valor |
|-------|--------|
| PR sugerido | `test(web): restore complete CI coverage` |
| Branch | `codex/0.2-restore-ci-coverage` |
| PR | https://github.com/Gleydsong/prospecting/pull/13 |
| Commit | `17d07c6` |

**Entregue:**
- Helper `apps/web/src/test/render.tsx` (QueryClient + Router + GoogleOAuth)
- Login page tests usam o helper
- Search tests toleram markup duplicado mobile/desktop (`getAllByRole`)
- `tsconfig.jest.json` com `isolatedModules` — sem warning TS151002; typecheck CI intacto
- Validação local: `pnpm test` verde (web 41 + api 232)

**Pendente de merge:** review + merge do PR #13 em `main`.

---

### 0.3 Corrigir vulnerabilidades de runtime e endurecer a CI — `next`

| Campo | Valor |
|-------|--------|
| PR sugerido | `security(deps): remediate runtime high advisories` |
| Status | **Próximo a executar** |

**Escopo previsto:**
- Atualizar Multer / `@nestjs/platform-express`, Next, avaliar React Router (SPA Vite)
- `pnpm.overrides` só com justificativa + `docs/security/audit-exceptions.md`
- CI falha em `high` de runtime; sem `continue-on-error` global permanente

---

### 0.4 Imagem de produção e migrations controladas — `todo` / `blocked`

| Campo | Valor |
|-------|--------|
| PR sugerido | `build(api): minimize production image and isolate migrations` |
| Bloqueio | Formato do job de migration + alteração de `render.yaml` **exigem aprovação explícita** |

**Escopo previsto:** runtime mínimo no Docker; migration em etapa única de release; health `live`/`ready` com Postgres+Redis.

---

## Fase 1 — experiência, desempenho e observabilidade

### 1.1 App rápido e resiliente — `todo`

| PR sugerido | `feat(web): add resilient lazy routes and error boundary` |
| Escopo | `React.lazy` rotas pesadas; `AppErrorBoundary`; Sentry condicional; lazy globe na landing |

### 1.2 Pipeline acessível e escalável — `todo`

| PR sugerido | `feat(pipeline): make stage movement accessible and paginated` |
| Escopo | Mover etapa por teclado/touch; `aria-live`; total + paginação além de 100 leads/coluna |

### 1.3 Operação mensurável — `todo`

| PR sugerido | `feat(observability): add private operational metrics and runbooks` |
| Escopo | Métricas privadas HTTP/jobs/filas; `correlationId`; runbooks; sem exposição pública |

---

## Fase 2 — qualidade de dados e priorização — `audited`

> Auditoria em 2026-08-01 (após PR #12). Base parcial existe; nenhum subitem completo.

### 2.1 Proveniência e confiança do lead — `audited` / `todo`

**Já existe (parcial):** `Lead.source`, `dataCollectedAt`, `websitePresence`, labels “Sem site informado” na busca.

**Gaps:** `lastVerifiedAt`, confiança, motivo do status; detalhe do lead mostra “Sem site”; tag `sem-site` demais; UI de proveniência incompleta.

### 2.2 Enriquecimento em duas etapas — `audited` / `todo`

**Já existe (parcial):** `SearchProvider` OSM/Google; import seletivo; Field Mask no Text Search.

**Gaps:** Place Details seletivo; estimate de custo; `EnrichmentProvider`; rating/reviews no mask.

### 2.3 Score explicável e sem limites silenciosos — `audited` / `todo`

**Já existe (parcial):** `LeadScore.rulesApplied`, `configVersion`, UI de regras no detalhe.

**Gaps críticos:** score monolítico (sem fit/opportunity/engagement); **`take: 5000` silencioso** em `ScoringService.recalculateOrganization`.

| PRs sugeridos (agrupados no workflow) | `feat(leads): add provenance and selective enrichment` · `feat(scoring): add explainable fit and opportunity scoring` |

**Ordem interna recomendada pós-auditoria:**
1. Fix semântica `NO_WEBSITE` (UI/tags)  
2. Expor proveniência no detalhe  
3. Migration confiança / `lastVerifiedAt`  
4. Enrichment Google + custo  
5. Score fit/opportunity/engagement  
6. Paginar recalc > 5k  

---

## Fase 3 — ciclo comercial que gera resultado — `todo`

### 3.1 Cadências e campanhas (assistidas) — `todo`

| PR sugerido | `feat(campaigns): introduce assisted outreach workflows` |
| Nota | Modelos Prisma `Campaign`, `CampaignLead`, `MessageTemplate`, `Integration` existem; sem módulo/controller/tela |

### 3.2 Integrações e exportação — `todo`

Webhook genérico primeiro; export auditado; HubSpot/Pipedrive depois.

### 3.3 Painel orientado à decisão — `todo`

Filtros + conversão, follow-ups, tempo entre etapas, cadências.

---

## Fase 4 — privacidade, auditoria e confiança — `todo`

### 4.1 Audit log realmente utilizado — `todo`

| PR sugerido (com 4.2) | `feat(compliance): operationalize audit and data-subject requests` |
| Nota | Modelo `AuditLog` existe; ainda não grava eventos |

### 4.2 Solicitações de titulares e retenção — `todo`

Workflow de export/delete `PENDING`; ROPA; retenção por entidade.

---

## Fase 5 — separar API e workers — `todo` / `blocked`

| PR sugerido | `infra(workers): split BullMQ processing after metric gate` |
| Pré-requisitos | Métricas da Fase 1.3 + evidência de carga |
| Bloqueio | Aprovação de infraestrutura / Render |

---

## Ordem canônica de PRs (checklist vivo)

- [x] 1. `fix(auth): deliver password reset emails safely` — **PR #12** (`done_pr_open`)
- [x] 2. `test(web): restore complete CI coverage` — **PR #13** (`done_pr_open`)
- [ ] 3. `security(deps): remediate runtime high advisories` — **next**
- [ ] 4. `build(api): minimize production image and isolate migrations`
- [ ] 5. `feat(web): add resilient lazy routes and error boundary`
- [ ] 6. `feat(pipeline): make stage movement accessible and paginated`
- [ ] 7. `feat(observability): add private operational metrics and runbooks`
- [ ] 8. `feat(leads): add provenance and selective enrichment`
- [ ] 9. `feat(scoring): add explainable fit and opportunity scoring`
- [ ] 10. `feat(campaigns): introduce assisted outreach workflows`
- [ ] 11. `feat(compliance): operationalize audit and data-subject requests`
- [ ] 12. `infra(workers): split BullMQ processing after metric gate`

---

## Histórico de atualizações deste catálogo

| Data | Evento |
|------|--------|
| 2026-08-01 | Catálogo criado. 0.1 e 0.2 implementados (PRs #12, #13). Fase 2 auditada. Próximo: 0.3. |

---

## Como atualizar

Ao concluir um subitem:
1. Marcar status (`done_pr_open` → `done_merged` após merge).
2. Preencher branch, PR, commit.
3. Mover o ✓ na checklist canônica.
4. Acrescentar linha no histórico.

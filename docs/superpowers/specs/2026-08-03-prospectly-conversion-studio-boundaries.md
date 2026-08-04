# Prospectly Conversion Studio — inventário e limites de implementação

> Estado: Fase 0 concluída (inventário)  
> Branch: `feat/prospectly-conversion-studio`  
> Data: 2026-08-03  
> Regra: não implementar código de produto nesta fase.

## 0. Observações de checkout

| Item | Estado |
|------|--------|
| `AGENTS.md` | **Ausente** no root. Workflow segue `docs/superpowers/specs/2026-08-01-prospectly-improvement-workflow-for-cursor.md` + `README.md`. |
| Worktree | Limpo em `main` antes do switch. |
| Branch | `feat/prospectly-conversion-studio` criada a partir de `main`. |
| Landing | Fora de escopo. |

## 1. Stack e topologia preservadas

- Monorepo pnpm: `apps/web` (React/Vite), `apps/api` (NestJS/Prisma/PostgreSQL/Redis/BullMQ), `apps/landing` (Next.js, fora).
- Workers BullMQ rodam **no mesmo processo HTTP** da API (`app.module.ts` + módulos `workers`).
- Multi-tenant: `organizationId` via `@CurrentOrg()` em controllers autenticados.
- Auth: JWT global (`JwtAuthGuard`) + `RolesGuard` + `EmailVerifiedGuard` + `ThrottlerGuard`.
- Roles: `OWNER`, `ADMIN`, `SALES`, `MEMBER`, `VIEWER` (`packages/shared-types` + Prisma).

## 2. Módulos API reutilizados (não duplicar)

| Módulo | Papel na feature | Caminho |
|--------|------------------|---------|
| `prospecting` | Busca, filtros, importação → CRM (`POST /searches/:id/import`) | `apps/api/src/modules/prospecting/` |
| `leads` + `lead-ingestion` | CRM, soft delete, export CSV, ownership | `apps/api/src/modules/leads/` |
| `scoring` | Score explicável, regras, tiers, `recommendedAction` | `apps/api/src/modules/scoring/` |
| `dashboard` | KPIs por período, top oportunidades | `apps/api/src/modules/dashboard/` |
| `pipelines` | Funil / stages | `apps/api/src/modules/pipelines/` |
| `activities` / `tasks` | Atividade e follow-up | respectivos módulos |
| `billing` | Plano (`OrgPlan`), `FREE_SEARCH_LIMIT`, checkout | `apps/api/src/modules/billing/` |
| `campaigns` | Assistido (sem envio automático externo) | `apps/api/src/modules/campaigns/` |
| `audit` | Modelo `AuditLog` existente | `apps/api/src/modules/audit/` |
| `geo` | País/estado/município | `apps/api/src/modules/geo/` |

**Convenção de pastas API:** a maioria usa `*.module.ts` + `*.service.ts` + `*.controller.ts` + `dto/`. Billing e campaigns usam `domain/` / `infrastructure/` / `presentation/` pontualmente. Conversion Studio segue o padrão **simples** (como `leads`/`scoring`), com subpastas só quando o arquivo crescer.

## 3. Front-end reutilizado

| Área | Caminho | Uso |
|------|---------|-----|
| Rotas | `apps/web/src/App.tsx` | Acrescentar rotas Pages/Studio; lazy onde pesado |
| Nav | `apps/web/src/components/layout/sidebar.tsx` | Item nav Conversion Studio / Pages |
| Search | `apps/web/src/pages/search-page.tsx` + `features/prospecting/` | Cards, filtros, import CRM |
| Leads | `apps/web/src/pages/leads/` + `features/leads/` | CTA “Criar página de proposta” |
| Pipeline | `apps/web/src/pages/pipeline-page.tsx` | Stage por teclado/ação (já padrão) |
| Dashboard | `apps/web/src/pages/dashboard-page.tsx` + `features/dashboard/` | Recomendações acionáveis |
| Billing UI | `apps/web/src/features/billing/` | Exibir uso/limite/upgrade CTA (sem cobrança nova) |
| Design system | tokens brand/zinc, `rounded-control`, i18n | Não copiar LeadSite |

**Ausente hoje:** `apps/web/src/features/conversion-studio/` e rotas públicas de página publicada.

## 4. Schema Prisma relevante (hoje)

Já existem: `Organization` (`plan`, `planStatus`, `currentPeriodEnd`), `Lead` (localização, contato, `websitePresence`, `score`, soft `deletedAt`), `LeadScore` (`rulesApplied`, `recommendedAction`), `ScoreConfiguration`/`ScoreRule`, `Search`/`SearchResult` (`importedLeadId`), `Pipeline`/`PipelineStage`, `LeadActivity`, `AuditLog`, `Campaign*`.

**Não existem (a criar na Fase 2):**

- `ConversionPage`
- `ConversionPageVersion`
- `ConversionPageAsset` (se upload interno for necessário)
- `ConversionEvent`
- `ConversionFormSubmission`
- `DomainBinding` (modelo + API; feature gated; **sem** DNS real nesta branch)
- `UsageLedger` / contadores tipados de entitlement (além do contador ad-hoc de searches free)

Enums a acrescentar (nomes finais na migração): status de página (`DRAFT`/`PREVIEW`/`PUBLISHED`/`ARCHIVED`), tipos de evento de conversão.

## 5. Auth, RBAC, planos e quotas atuais

### Auth / org

- JWT access + refresh; `organizationId` no token/contexto.
- Guards globais; `@Roles(...)` por rota.
- `@CurrentOrg()` / `@CurrentUser()` — **nunca** aceitar `organizationId` do body do cliente.

### Planos (`OrgPlan`)

- `FREE`, `STARTER_MONTHLY`, `LIFETIME`.
- Quota existente: `FREE_SEARCH_LIMIT = 3` em `billing.constants.ts`; gate em `BillingService` antes de criar search.
- **Não há** `EntitlementService` / `UsageMeteringService` / FeatureGate tipado central — **criar na Fase 4**, evoluir a partir de billing (sem Stripe/Abacate novo sem autorização).

### Features a mapear em entitlement (Fase 4)

| Feature key | MVP metering | Fonte |
|-------------|--------------|-------|
| `searches` | contagem por org (já parcial) | `Search` |
| `published_pages` | count status PUBLISHED | novo |
| `page_drafts` | opcional; preferir não limitar edições | novo |
| `version_history` | profundidade de versões | novo |
| `csv_export` | flag | leads export |
| `advanced_geo_search` | flag | prospecting/geo |
| `custom_domain` | flag + DomainBinding stub | novo |
| `remove_prospectly_brand` | flag | publish |
| `analytics_pixel` | flag | fora ou stub |
| `team_members` | count members | `OrganizationMember` |
| `ai_generations` | flag/counter futuro | **não integrar IA externa** |

## 6. Contratos e semântica a preservar

- `WebsitePresence.NO_WEBSITE_REPORTED` = fonte não informou website. UI/score: “website não informado pela fonte”; **nunca** “empresa sem site”.
- Score key legado `NO_WEBSITE` já descreve oportunidade sem afirmação definitiva (`scoring.service.spec.ts`). Manter semântica; preferir copy/UI alinhada a `NO_WEBSITE_REPORTED`.
- Import CRM: `ProspectingService.importResults` + `LeadIngestionService.ingest` — idempotente por org (`externalId`/duplicatas). Evoluir feedback por lead; lote só se DTO atual (`ImportSearchResultsDto.resultIds`) permitir (já lista IDs).
- Campanhas: assistidas; **sem** envio automático e-mail/WhatsApp/LinkedIn.
- Conteúdo de páginas: **JSON schema validado**, sem HTML arbitrário no banco.
- Links externos: HTTPS + `rel="noopener noreferrer"`; bloqueio `javascript:`.

## 7. Rotas web atuais (App.tsx)

Auth, dashboard `/`, `search`, `imports`, `leads`, `leads/:id`, `pipeline`, `tasks`, `campaigns`, `settings`, billing PIX/result.

**Novas (planejadas):**

- `/pages` — lista projetos Conversion Studio
- `/pages/:id/edit` — editor
- `/pages/:id/analytics` — métricas
- Rota pública de leitura publicada: path slug opaco (não UUID enumerável), fora do `AppLayout` autenticado
- Entrada principal: Lead detail → “Criar página de proposta”

## 8. Arquivos previstos por fase

### Fase 0 (este doc)

- `docs/superpowers/specs/2026-08-03-prospectly-conversion-studio-boundaries.md`

### Fase 1 — descoberta / CRM / dashboard

- `apps/api/src/modules/scoring/*` (explicações/sinais se necessário)
- `apps/api/src/modules/prospecting/*` (filtros websitePresence / feedback import)
- `apps/api/src/modules/dashboard/*` (recomendações + fórmulas)
- `apps/web/src/features/prospecting/*`, search page, lead cards
- `apps/web/src/features/dashboard/*`
- `packages/shared-types` se contratos novos

### Fase 2 — domínio páginas

- `apps/api/prisma/schema.prisma` + migration
- `apps/api/src/modules/conversion-studio/` (module/service/controller/dto/tests)
- `packages/shared-types` enums/DTOs
- Relação opcional `Lead` ↔ `ConversionPage`

### Fase 3 — editor / publish

- `apps/web/src/features/conversion-studio/**`
- `apps/web/src/pages/conversion-studio/*`
- Validação Zod compartilhada de blocos (API + web)
- Sidebar + App routes
- Public page renderer (somente blocos seguros)

### Fase 4 — eventos / entitlements

- Models eventos/submissões + serviços
- `EntitlementService` / `UsageMeteringService` / FeatureGate
- Extensão billing response tipada
- UI upgrade CTA (sem pagamento real novo)

### Fase 5 — docs / qualidade

- `docs/architecture/` ou `docs/superpowers/` guia operacional
- Correções pós-validação `pnpm lint|typecheck|test|build|audit`

## 9. Fora de escopo (explícito)

- Push/merge/deploy/migração remota.
- Cobrança real / alteração de assinatura / Stripe-Abacate novos fluxos.
- Domínio custom DNS real.
- IA externa / geração assistida real.
- Envio automático de mensagens.
- Editor HTML/CSS/JS livre.
- Worker BullMQ separado (eventos síncronos ou fila existente só se seguro).
- Alterações `render.yaml` / infra sem autorização.

## 10. Decisões de produto a confirmar se bloquearem

1. Slug público: random vs humanizado (preferência: **opaco**, anti-enumeração).
2. Limite draft vs published-only (preferência: **published + domínio + membros**).
3. Upload de assets: storage local efêmero é inadequado no Render — preferir URL HTTPS validada ou object storage; **sem** inventar S3 sem decisão.
4. Formulário público: reCAPTCHA vs honeypot + rate limit (preferência: **Throttler + honeypot**, sem vendor novo).

## 11. Critérios de aceite da Fase 0

- [x] Inventário de módulos, rotas, tabelas, auth, planos.
- [x] Lista de arquivos a modificar por fase.
- [x] Lacunas (sem Entitlement central, sem ConversionPage, AGENTS.md ausente).
- [x] Branch criada; sem implementação de produto nesta fase.

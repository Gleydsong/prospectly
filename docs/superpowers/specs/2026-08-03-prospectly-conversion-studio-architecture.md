# Prospectly Conversion Studio — arquitetura e guia operacional

> Branch: `feat/prospectly-conversion-studio`  
> Data: 2026-08-03  
> Inventário: `docs/superpowers/specs/2026-08-03-prospectly-conversion-studio-boundaries.md`

## Proposta de valor

Encontrar negócio com potencial, gerar oferta digital personalizada e acompanhar conversão sem sair do Prospectly.

Fluxo:

```text
Busca → sinal de oportunidade → CRM → página de proposta → publicação → métricas
```

## Arquitetura

### API (`apps/api/src/modules/conversion-studio/`)

| Peça | Responsabilidade |
|------|------------------|
| `ConversionStudioService` | CRUD, draft concurrency, publish/unpublish/archive, restore, metrics, public read/form/events |
| `EntitlementService` | Limites por `OrgPlan`, snapshot tipado, `UsageLedger` idempotente |
| `page-blocks.schema.ts` | Zod: blocos estruturados + ações de botão seguras |
| Controllers | Autenticado (`/conversion-pages`) e público (`/public/pages/:slug`) |

Isolamento multi-tenant: toda query autenticada filtra `organizationId` via `@CurrentOrg()`. Rotas públicas resolvem org pelo `publicSlug` opaco (não enumerável).

### Web (`apps/web/src/features/conversion-studio/`)

- Lista `/pages`, editor `/pages/:id/edit`, pública `/p/:slug`
- Entrada no lead: **Criar página de proposta**
- Editor: biblioteca | canvas/preview | propriedades
- Reordenação por botões (teclado/acessível), sem DnD obrigatório
- `FeatureGateBanner` mostra limite/plano sem bloquear navegação geral

### Persistência

Migração: `20260803120000_conversion_studio`

Tabelas: `ConversionPage`, `ConversionPageVersion`, `ConversionPageAsset`, `ConversionEvent`, `ConversionFormSubmission`, `DomainBinding`, `UsageLedger`.

Ciclo de vida: `DRAFT → PREVIEW → PUBLISHED → ARCHIVED`. Publicação cria versão imutável; restore copia snapshot para o draft e audita evento.

## Contratos de segurança

- Sem HTML arbitrário no banco
- URLs externas apenas HTTPS; `rel="noopener noreferrer"`
- Formulário público: honeypot + throttle; payload whitelist; nunca aceita `organizationId` do cliente
- `NO_WEBSITE_REPORTED` = fonte não informou site
- Sem envio automático de canais externos
- Logs: sem conteúdo completo de formulário

## Entitlements (MVP)

| Plano | Publicadas | Rascunhos | Domínio próprio | Remover marca |
|-------|------------|-----------|-----------------|---------------|
| FREE | 1 | 5 | não | não |
| STARTER_MONTHLY | 20 | 100 | não | não |
| LIFETIME | 100 | 500 | sim | sim |

Backend é fonte da verdade. Quota de publish/draft é verificada antes; `UsageLedger` usa chave de idempotência.

## Métricas

Eventos: `page_view`, `cta_click`, `form_started`, `form_submitted`, `page_published`, `page_unpublished`, `page_version_restored`.

KPIs por página (período em dias): visitas, cliques CTA, envios, taxa conversão (`form_submitted/views`), CTA top, última conversão.

## Operação local

```bash
pnpm db:generate
pnpm db:migrate   # aplica 20260803120000_conversion_studio
pnpm --filter @prospectly/api test
pnpm --filter @prospectly/web test
pnpm typecheck
pnpm build
```

Migração remota / Render / pagamento real: **exige autorização explícita**.

## Fora de escopo nesta branch

- DNS/domínio custom real
- Stripe upgrade nesta feature
- IA externa
- Upload S3 (assets via URL HTTPS validada)
- Worker BullMQ dedicado para eventos
- Automação de outreach

## Próximos passos sugeridos

1. Aplicar migração em ambiente descartável e validar fluxo E2E no browser
2. Object storage para assets
3. DomainBinding + verificação DNS
4. Activity no lead a partir de submission (actor de sistema)
5. Feature flags de pixel/analítica com consentimento

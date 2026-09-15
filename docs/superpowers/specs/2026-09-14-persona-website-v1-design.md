# Design: persona profissional + módulo Website (v1)

**Data:** 2026-09-14  
**Status:** Aprovado pelo humano (2026-09-14). Pronto para implementar.  
**Branch:** `feat/persona-website-v1`  
**Decisões humanas:** abordagem B; Q1=C; Q2=C; Q3=B

## Problem Statement

O Prospectly hoje prospecta empresas (OpenStreetMap / Google Places) e trata o resultado como Lead no funil de **vendedor**. Quem cria a conta não diz que profissional é. Depois de ganhar o negócio, não há sítio de primeira classe para guardar os **sites** que um desenvolvedor (ou agência) entregou a esse cliente. A UI chama “Clientes” ao Lead, mas o produto não se molda a tráfego pago, marketing ou desenvolvimento.

## Solution

A plataforma continua um único CRM. O aggregate da empresa continua a ser o **Lead**. Não existe tabela `Client`.

No signup, a organização escolhe uma **persona default**. Cada membro pode **sobrepor** a persona naquela organização. A persona não esconde a busca nem o funil: só muda o destaque da UI.

Nesta v1 liga-se o módulo **Website**: cada Lead tem 0..N URLs (com etiqueta, tipo e notas). Pode anexar-se em qualquer estágio; o bloco “ficha de cliente” fica mais visível depois de Ganhos.

## Language

Usar estes termos (e não os da coluna Avoid) em spec, issues, UI copy e schema comments.

| Termo | Significado | Avoid |
| --- | --- | --- |
| **Persona profissional** | Papel de mercado do membro na organização: molda defaults de UI, não permissões. | Role, plano, job title livre, ICP |
| **Persona default da organização** | Valor no tenant, escolhido no signup. | Persona global da conta Google |
| **Override de persona** | Valor no **membro** (não no User global): esta org, este user. `null` = segue o default da org. | Override no User (parte orgs) |
| **Persona efetiva** | `override ?? default da org` | “tipo de conta” |
| **Lead** | Empresa prospectada ou cliente ganho. Unidade comercial. | Client, Customer, Account (CRM) |
| **Website do Lead** | Ativo URL ligado a um Lead. | Site da Organization tenant, custom object, Campo personalizado |
| **Ganhos** | Estágio / status won já existentes. Destaca a ficha; não destrava o módulo. | Conversão para outra entidade |
| **Módulo** | Capacidade opcional sobre o Lead (v1: Website). | Produto vertical separado, Organization flag de capability |

`Role` (`OWNER` / `ADMIN` / `SALES` / `MEMBER` / `VIEWER`) continua a ser **permissão**. Não misturar com persona.

`Organization` continua a ser o **tenant**. Não usar “Organization” no sentido Attio/HubSpot de empresa cliente.

## User Stories

1. As a visitante a criar conta por email, I want to choose a persona profissional in the same flow as the organization name, so that the app opens already shaped for how I work.
2. As a visitante, I want **vendedor** pre-selected, so that the current ICP is not extra friction.
3. As a visitante em OAuth Google, I want to set the organization persona before using the dashboard the first time, so that Google signup does not skip the mold.
4. As an OWNER, I want the chosen value stored as the organization default, so that new members inherit it.
5. As a member, I want to override my persona in this organization without changing the org default, so that a closer and a developer can share the same Leads.
6. As an OWNER/ADMIN, I want to change the organization default later in Settings, so that a shop that started as vendedor can become an agency.
7. As a member, I want to clear my override and follow the org default again, so that I am not stuck on a personal choice.
8. As a developer (effective persona), I want a clear **Sites** block on the Lead, so that I can record the websites I already shipped or will ship.
9. As a vendedor (effective persona), I want the same Sites block available but secondary, so that I do not lose the pipeline-first layout.
10. As a marketing or tráfego pago user in v1, I want the same Website module (no ad accounts yet), so that landings can be stored without waiting for OAuth.
11. As any member with lead access, I want to add a website to a Lead that is still in the funnel, so that due diligence is not blocked until Ganhos.
12. As any member, I want the Sites block visually emphasized after Ganhos, so that the “client file” is obvious once the deal is won.
13. As any member, I want to add several websites per Lead (site, landing, app), so that one client with marketing site + app is representable.
14. As any member, I want optional label and notes on a website, so that “Loja WP” vs raw URL is readable.
15. As any member, I want to edit or remove a website without deleting the Lead, so that URLs can change after go-live.
16. As a VIEWER, I want to read websites and personas but not mutate them, so that permission stays aligned with the rest of the CRM.
17. As a user of Busca, I want OSM/Places import unchanged, so that persona does not break prospecting.
18. As an existing organization (pre-v1), I want default persona **vendedor** without a blocking wall, so that production tenants are not locked out.
19. As a user in two organizations, I want a different override per membership, so that persona does not leak across tenants.
20. As a future implementer of AdAccount, I want Website to be the template for a Lead child resource, so that we do not invent a Client table later.

## Implementation Decisions

1. **No `Client` table.** Website is a child of Lead, same tenant as the Lead. Conversion to “cliente” remains Ganhos (`PipelineStage.isWon` and/or `LeadStatus.WON` as the product already does). Do not copy the Lead into another aggregate.

2. **Persona enum (closed).** `vendedor` | `desenvolvedor` | `trafego_pago` | `marketing` | `outro`. No free-text persona in v1. `outro` uses the same core UI as `vendedor` (no extra module).

3. **Where fields live.** Organization holds `defaultPersona` (required after onboarding). OrganizationMember holds `personaOverride` (nullable). Do **not** put override on User: a user can belong to many organizations.

4. **Effective persona.** `personaOverride ?? defaultPersona`. Server computes it; clients do not invent a third source. Use it only for UI prominence and copy, not for authorization.

5. **Website module availability.** Data API is available to every organization in v1 (no Organization flag). Persona only changes **prominence** (developer/marketing: primary block; vendedor/tráfego/outro: present but secondary). Tráfego pago does **not** get AdAccount in v1.

6. **Website resource.** Per Lead, 0..N records: `url` (required, http/https), `label` (optional), `kind` (`site` | `landing` | `app`), `notes` (optional, length-capped). Unique `(leadId, urlNormalized)` so the same URL cannot be stored twice on one Lead. Soft-deleted Leads cascade or hide children with the Lead (same rule as other Lead children).

7. **Signup email/password.** Same payload that creates the organization requires `defaultPersona`. Preset UI value `vendedor`. Reject missing/invalid enum with 400.

8. **Signup Google.** If the newly provisioned organization has not completed persona onboarding, the web app blocks the dashboard until the OWNER sets `defaultPersona` (short dedicated step). Existing orgs backfilled as vendedor are treated as complete.

9. **Settings.** OWNER/ADMIN patch organization default. Any member patches own override (including `null` to follow default). VIEWER is read-only.

10. **Authorization.** Mutating websites follows existing Lead write rules (not VIEWER). Persona settings as above. Server enforces tenant: `organizationId` only from session.

11. **Do not reuse Organization flags** for persona. Flags are capability toggles (`saved_report`, etc.). Persona is a first-class domain field.

12. **Do not store AdAccount, OAuth tokens, uptime, SSL, or hosting billing** in v1.

13. **i18n.** Persona labels and Website `kind` labels in pt and en, same pattern as the rest of the web app.

14. **Domain docs.** New glossary context for persona + Website do Lead; add a line on the context map. Update custom-fields/views language only if copy would collide (“Clientes” still means Lead).

15. **Migration of existing rows.** All current organizations: `defaultPersona = vendedor`, onboarding marked complete. Members: `personaOverride = null`.

## Testing Decisions

Test **behavior** through public HTTP (or the app’s existing API test seam), not Prisma internals.

**Good tests:** register without persona → 400; register with `desenvolvedor` → org default set; member override changes effective persona only for that membership; second org of the same user does not inherit the first override; VIEWER cannot POST a website; member can POST a website on a Lead that is not won; duplicate normalized URL on the same Lead → 409; Lead of another org → 404; Ganhos vs not-Ganhos does not change API authorization (only UI).

**Modules:** auth/provision, organization/member settings, Lead website collection. Prior art: organization-flags tests (tenant + OWNER/ADMIN mutate), custom-field definition tests (org-scoped schema), Lead update tenant isolation.

**UI:** not a substitute for API tests. If there is an existing register form test, extend it with the persona control. Website block prominence can be a component test (won vs not won) without e2e of OSM.

## Out of Scope

- Tabela Client / Customer / Account de CRM
- Módulo AdAccount, Google Ads MCC, Meta Business, OAuth de anúncios
- Monitoring (uptime, SSL, PageSpeed)
- Esconder Busca, Pipeline, WhatsApp ou OSM/Places consoante persona
- Custom objects genéricos definidos pelo utilizador
- Persona como Role ou como plano de billing
- Multi-persona simultânea no mesmo membro (um override só)
- Relatórios / Workflows / Vistas filtrados por Website nesta v1
- Redesign completo da nav

## Test seams (v1)

Prefer existing seams:

1. **Register / provision** — highest seam for persona default.
2. **Organization member profile** — override and effective persona.
3. **Lead child collection (Website)** — same style as other org-scoped Lead writes.

No new message bus. No DomainEvent required in v1 (Website is not a funnel fact). Revisit events only if Workflows must react to “site added”.

## Further Notes

Pesquisa e grill: nota Maestri `RESEARCH-PERSONA-CRM`. Mercado: Attio liga objetos por use case no signup; “customer” nos CRMs é estágio, não objeto. AgencyAnalytics liga website ao client; v1 faz o equivalente no Lead.

v2 prevista (não implementar agora): AdAccount como segundo filho do Lead (acesso, não senha), nav de tráfego pago.

Implementação só depois deste ficheiro ser revisto pelo humano e existir issue/PR desta spec. Merge da spec não autoriza merge do código da feature.

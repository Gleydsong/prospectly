# Persona profissional + Website do Lead (v1) Implementation Plan

> **For agentic workers:** Implement task-by-task with TDD at the three spec seams. Squad Prospectly: **Programador writes code and tests; do not git commit/push/PR** (Luna does git). Do not merge.

**Goal:** Signup stores an organization default professional persona, members can override it per membership, and each Lead can have 0..N inventory websites (`LeadWebsite`) without a Client table and without touching the existing 1:1 analysis `Website` model.

**Architecture:** First-class Prisma fields on `Organization` and `OrganizationMember`. Effective persona is `personaOverride ?? defaultPersona`, computed on the server and returned on auth + current org. `LeadWebsite` is a Lead child (N URLs) with RLS via Lead.organizationId, same pattern as analysis `Website_via_lead`. UI uses effective persona only for Sites-block prominence.

**Tech Stack:** NestJS + Prisma + PostgreSQL RLS, existing `class-validator` DTOs, Jest API tests (`apps/api`), Vite React 19 + RHF/Zod + i18n + Vitest (`apps/web`). pnpm filters `@prospectly/api` and `@prospectly/web`.

**Spec:** `docs/superpowers/specs/2026-09-14-persona-website-v1-design.md`

## Global Constraints

- No table named Client / Customer / Account (CRM).
- Do **not** reuse or alter Prisma model `Website` (lead analysis, 1:1). New model name **must** be `LeadWebsite`.
- Persona enum closed: `vendedor` | `desenvolvedor` | `trafego_pago` | `marketing` | `outro`.
- Override lives on **OrganizationMember**, never on User.
- Persona does not change Role or hide Busca / Pipeline / OSM / Places.
- Website API allowed at any lead stage; UI emphasizes the block after Ganhos (`stage.isWon` or `status === 'WON'`).
- Duplicate URL on the same Lead → HTTP 409.
- VIEWER reads; cannot mutate persona default, override, or LeadWebsite.
- No DomainEvent for Website in v1.
- No OrganizationFlag for persona.
- No AdAccount / OAuth ads / uptime.
- `vercel-react-best-practices` when touching React.
- Commits: Luna only.

### File map

- Create: `apps/api/prisma/migrations/<timestamp>_persona_lead_website/migration.sql`
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/common/prisma/tenant-guard.ts` (add `LeadWebsite` to `CHILD_MODELS`)
- Modify: `apps/api/src/common/prisma/rls.integration.spec.ts` (policy via lead, if this file inserts sibling child rows)
- Modify: `apps/api/src/modules/auth/dto/register.dto.ts`, `google-auth.dto.ts`, `auth.service.ts`, `auth.service.spec.ts`
- Modify: `apps/api/src/modules/organizations/*` (default persona + self override)
- Create: `apps/api/src/modules/lead-websites/` (controller/service/dto/specs) **or** nest under `leads` as `leads/:leadId/websites` — prefer nested on `LeadsController` / small `LeadWebsitesService` in `apps/api/src/modules/leads/` to avoid a second tenant stack
- Modify: `apps/web/src/types/index.ts`, `features/auth/api.ts`, `pages/auth/register-page.tsx` + tests
- Create: `apps/web/src/pages/auth/persona-onboarding-page.tsx` + test
- Modify: `apps/web/src/components/protected-route.tsx` + test (OWNER + `personaOnboardedAt == null` → `/onboarding/persona`)
- Modify: `apps/web/src/pages/settings-page.tsx`, `features/organizations/api.ts`
- Create: `apps/web/src/features/leads/components/lead-websites-card.tsx` + test
- Modify: `apps/web/src/pages/leads/lead-detail-page.tsx`
- Modify: `apps/web/src/i18n/locales/pt.json`, `en.json`
- Create: `docs/domain/professional-persona/CONTEXT.md`
- Modify: `CONTEXT-MAP.md`

### Shared types (use exactly)

```ts
export const PROFESSIONAL_PERSONAS = [
  'vendedor',
  'desenvolvedor',
  'trafego_pago',
  'marketing',
  'outro',
] as const;
export type ProfessionalPersona = (typeof PROFESSIONAL_PERSONAS)[number];

export const LEAD_WEBSITE_KINDS = ['site', 'landing', 'app'] as const;
export type LeadWebsiteKind = (typeof LEAD_WEBSITE_KINDS)[number];

export function effectivePersona(
  defaultPersona: ProfessionalPersona,
  personaOverride: ProfessionalPersona | null,
): ProfessionalPersona {
  return personaOverride ?? defaultPersona;
}

export function normalizeLeadWebsiteUrl(raw: string): string {
  const parsed = new URL(raw.trim());
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('invalid_url');
  }
  parsed.hash = '';
  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
  return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
}
```

Put `effectivePersona` in a tiny shared module used by API (and mirrored in web if needed). URL helper lives on the API; web can send raw URL.

Auth user extras:

```ts
defaultPersona: ProfessionalPersona;
personaOverride: ProfessionalPersona | null;
effectivePersona: ProfessionalPersona;
personaOnboardedAt: string | null;
```

---

### Task 1: Schema, RLS, tenant guard

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<date>_persona_lead_website/migration.sql`
- Modify: `apps/api/src/common/prisma/tenant-guard.ts`
- Test: `apps/api/src/common/prisma/tenant-guard.spec.ts` (if present) or rls spec

**Interfaces:**
- Consumes: existing `Organization`, `OrganizationMember`, `Lead`, analysis `Website`
- Produces: enums + fields + `LeadWebsite`

Prisma (add; do not rename `Website`):

```prisma
enum ProfessionalPersona {
  vendedor
  desenvolvedor
  trafego_pago
  marketing
  outro
}

enum LeadWebsiteKind {
  site
  landing
  app
}

// on Organization:
defaultPersona        ProfessionalPersona @default(vendedor)
personaOnboardedAt    DateTime?

// on OrganizationMember:
personaOverride       ProfessionalPersona?

model LeadWebsite {
  id            String           @id @default(uuid())
  leadId        String
  url           String
  urlNormalized String
  label         String?
  kind          LeadWebsiteKind  @default(site)
  notes         String?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  lead          Lead             @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@unique([leadId, urlNormalized])
  @@index([leadId])
}
```

Add `leadWebsites LeadWebsite[]` on `Lead`.

Migration SQL must:

1. Create enums.
2. Add columns with `DEFAULT 'vendedor'` and `personaOnboardedAt = CURRENT_TIMESTAMP` for existing orgs (onboarding complete).
3. `personaOverride` nullable, no backfill.
4. Create `LeadWebsite` table + unique + FK cascade.
5. `ENABLE ROW LEVEL SECURITY` + `FORCE` + policy `LeadWebsite_via_lead` copied from `Website_via_lead` but `"LeadWebsite"."leadId"`.

`CHILD_MODELS` add `'LeadWebsite'`.

- [ ] **Step 1:** Add a unit test that `assertTenantOperation` / child set includes `LeadWebsite` if that is how sibling models are tested. If only RLS SQL exists, add the policy to the migration and extend `rls.integration.spec.ts` the same way `Website` is covered (insert LeadWebsite for org A, fail as org B).
- [ ] **Step 2:** Run the targeted test — RED if the model/policy is missing.
- [ ] **Step 3:** Schema + migration + tenant-guard.
- [ ] **Step 4:** `pnpm --filter @prospectly/api exec prisma generate` and tests GREEN.
- [ ] **Step 5:** Do not commit.

---

### Task 2: Register / Google provision (seam 1)

**Files:**
- Modify: `apps/api/src/modules/auth/dto/register.dto.ts`
- Modify: `apps/api/src/modules/auth/dto/google-auth.dto.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Test: `apps/api/src/modules/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 columns
- Produces: `AuthResponse.user` with persona fields; register requires `defaultPersona`

`RegisterDto` add:

```ts
@ApiProperty({ enum: ['vendedor', 'desenvolvedor', 'trafego_pago', 'marketing', 'outro'] })
@IsIn(['vendedor', 'desenvolvedor', 'trafego_pago', 'marketing', 'outro'])
defaultPersona!: 'vendedor' | 'desenvolvedor' | 'trafego_pago' | 'marketing' | 'outro';
```

`GoogleAuthDto`: optional `defaultPersona` with same `@IsIn` when present.

`provisionOwnerAccount` input adds `defaultPersona` and `personaOnboardedAt: Date | null`.

- Email register: required persona; `personaOnboardedAt = new Date()`.
- Google **new** org: if `defaultPersona` provided, same as email; if omitted, `defaultPersona = vendedor` and `personaOnboardedAt = null` (dashboard wall).
- Google **existing** user: unchanged onboarding fields.
- `buildAuthResponse` loads membership; sets the four persona fields on `user`.

Existing `service.register({...})` calls in `auth.service.spec.ts` **must** gain `defaultPersona: 'vendedor'` or they fail validation at the service layer (service receives typed dto; class-validator runs in HTTP e2e — still add the field in unit tests that pass the object through).

- [ ] **Step 1:** Failing tests in `auth.service.spec.ts`:
  - `register without defaultPersona` — if the service itself throws BadRequest when missing (throw in service if `!input.defaultPersona` for the email path). Prefer DTO validation: add a dedicated DTO spec like other dtos (`register.dto.spec.ts` if the folder uses that) asserting class-validator rejects missing enum.
  - `register with desenvolvedor persists organization.defaultPersona and personaOnboardedAt`.
  - `google new account without defaultPersona sets vendedor and null personaOnboardedAt`.
  - `buildAuthResponse effectivePersona uses membership override`.
- [ ] **Step 2:** Run `pnpm --filter @prospectly/api exec jest src/modules/auth/auth.service.spec.ts src/modules/auth/dto/register.dto.spec.ts --no-coverage` — RED.
- [ ] **Step 3:** Implement provision + DTO + buildAuthResponse. Update every `register({` fixture in the spec file with `defaultPersona: 'vendedor'`.
- [ ] **Step 4:** Tests GREEN.
- [ ] **Step 5:** Do not commit.

---

### Task 3: Organization default + member override (seam 2)

**Files:**
- Modify: `apps/api/src/modules/organizations/dto/update-organization.dto.ts` (make `name` optional if also sending persona, **or** add `PatchOrganizationPersonaDto` to avoid breaking name-only PATCH)
- Create: `apps/api/src/modules/organizations/dto/patch-persona-override.dto.ts`
- Modify: `organizations.controller.ts`, `organizations.service.ts`, `*.spec.ts`
- Modify: `apps/web` later in Task 5 for settings

**Preferred HTTP (do not overload name PATCH awkwardly):**

- `PATCH /organizations/current/persona` `@Roles('OWNER','ADMIN')` body `{ defaultPersona }` — sets default; if `personaOnboardedAt` was null, set it to now.
- `PATCH /organizations/me/persona-override` any authenticated member except forbid VIEWER write: `@Roles('OWNER','ADMIN','SALES','MEMBER')` body `{ personaOverride: ProfessionalPersona | null }`.

`GET /organizations/current` includes `defaultPersona`, `personaOnboardedAt`.

VIEWER calling override PATCH → 403.

- [ ] **Step 1:** Tests in `organizations.service.spec.ts` / controller spec: OWNER updates default; MEMBER updates own override; VIEWER cannot; effective persona for member B does not change member A.
- [ ] **Step 2:** RED.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** GREEN.
- [ ] **Step 5:** Do not commit.

---

### Task 4: LeadWebsite CRUD (seam 3)

**Files:**
- Create: `apps/api/src/modules/leads/lead-websites.service.ts` + `.spec.ts`
- Create: `apps/api/src/modules/leads/dto/lead-website.dto.ts`
- Modify: `leads.controller.ts`, `leads.module.ts`

**HTTP:**

- `GET /leads/:leadId/websites`
- `POST /leads/:leadId/websites` `@Roles('OWNER','ADMIN','SALES','MEMBER')`
- `PATCH /leads/:leadId/websites/:websiteId`
- `DELETE /leads/:leadId/websites/:websiteId` → 204

Body POST: `{ url, label?, kind?, notes? }`. `url` max 2048, `label` max 120, `notes` max 2000. Invalid URL → 400. Duplicate `urlNormalized` on same lead → 409. Other org lead → 404. VIEWER POST → 403. Lead not WON still allows POST.

Won vs not-won: **same 201**. No extra authorization.

- [ ] **Step 1:** Service tests with mocked prisma: create ok; duplicate unique → map to ConflictException; lead missing → NotFoundException; VIEWER not tested here if Roles guard is controller-only — add controller spec for 403.
- [ ] **Step 2:** RED.
- [ ] **Step 3:** Implement. Never write to analysis `Website`.
- [ ] **Step 4:** GREEN. Also `pnpm --filter @prospectly/api test` for regressions.
- [ ] **Step 5:** Do not commit.

---

### Task 5: Web app (register, gate, settings, Lead card)

**Files:** listed in File map. Follow `vercel-react-best-practices`.

**Register:** Zod enum, Select default `vendedor`, send `defaultPersona`. Update `register-page.test.tsx` so `submitValidRegistration` still works (default select). Add test that register payload includes `defaultPersona: 'vendedor'` unless changed.

**Google register:** pass `defaultPersona` from the same select when creating an account.

**Gate:** `ProtectedRoute`: if `user.role === 'OWNER' && !user.personaOnboardedAt` and path is not `/onboarding/persona`, `<Navigate to="/onboarding/persona" />`. Onboarding page PATCHes `/organizations/current/persona` then updates auth store.

**Settings:** Select org default (OWNER/ADMIN). Select personal override including option “Seguir organização” (`null`). VIEWER: disabled.

**Lead detail:** `LeadWebsitesCard`. If `effectivePersona` is `desenvolvedor` or `marketing`, render the card **above** analysis/gap content. Otherwise below (secondary). If `lead.stage?.isWon` or `lead.status === 'WON'`, add a stronger heading/class (e.g. border emphasis). CRUD via new functions in `features/leads/api.ts`.

**i18n:** `persona.*` and `leadWebsites.*` keys in `pt.json` and `en.json`.

- [ ] **Step 1:** Tests RED (`register-page`, `protected-route`, `lead-websites-card`).
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** `pnpm --filter @prospectly/web test` and `typecheck` GREEN.
- [ ] **Step 4:** Do not commit.

---

### Task 6: Domain docs

**Files:**
- Create: `docs/domain/professional-persona/CONTEXT.md` (Language table from the spec)
- Modify: `CONTEXT-MAP.md` — one bullet + relationships: Persona → OrganizationMember; LeadWebsite → Lead; ↛ analysis Website

No product behavior change.

- [ ] Write docs using spec Language (Avoid column).
- [ ] Do not commit.

---

## Spec coverage

| Spec | Task |
| --- | --- |
| No Client table | 1, 4 |
| Enum + org default + member override + effective | 1–3 |
| Email register required persona, preset vendedor | 2, 5 |
| Google onboarding wall | 2, 5 |
| Existing orgs backfill vendedor + onboarded | 1 |
| Multi-org override isolation | 2, 3 |
| LeadWebsite fields, 409, any stage | 4 |
| Prominence by persona + Ganhos | 5 |
| VIEWER read-only | 3, 4, 5 |
| i18n | 5 |
| Domain glossary | 6 |
| Out of scope ads/OAuth | all |

## After code is green

Programador: `maestri ask "Cursor CLI"` with files, tests, risks. Then Lead → Testador → Revisor → Luna commit/push on `feat/persona-website-v1` (same PR 261, convert from draft when code lands). Merge only with human yes.

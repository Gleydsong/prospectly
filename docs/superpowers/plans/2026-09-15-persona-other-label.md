# Persona Other Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a 2–40 character label when organization default persona is `outro`, and show a persona tag under the login name in the sidebar.

**Architecture:** Additive `Organization.personaOtherLabel`. Normalize on every write: required iff `defaultPersona === 'outro'`, otherwise `null`. Session and GET current org return the field. Web shows a conditional Input and a sidebar Badge. No member-level other-label in this slice.

**Tech Stack:** Prisma, NestJS class-validator, existing web Select/Input/Badge, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-15-persona-other-label-design.md`

## Global Constraints

- Enum `ProfessionalPersona` unchanged.
- Trim; min 2; max 40; never persist `""`.
- `outro` without label → 400. Non-`outro` always stores `null` for the label.
- Zero commit/push/merge unless Luna is asked. Programador does not git commit.
- Worktree: `/Users/guidev/orca/workspaces/prospectly/persona-other-label` branch `feat/persona-other-label`.

---

### Task 1: API normalize + persist

**Files:**
- Modify: `apps/api/src/common/professional-persona.ts`
- Modify: `apps/api/src/modules/auth/dto/register.dto.ts`
- Modify: `apps/api/src/modules/auth/dto/register.dto.spec.ts`
- Modify: `apps/api/src/modules/auth/dto/google-auth.dto.ts`
- Modify: `apps/api/src/modules/organizations/dto/patch-organization-persona.dto.ts`
- Modify: `apps/api/src/modules/organizations/organizations.service.ts`
- Modify: `apps/api/src/modules/organizations/organizations.service.spec.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts` (register + `buildAuthResponse`)
- Modify: `apps/api/src/modules/auth/auth.service.spec.ts`
- Modify: `apps/api/prisma/schema.prisma` (`Organization.personaOtherLabel String?`)
- Create: `apps/api/prisma/migrations/20260915140000_persona_other_label/migration.sql`

**Interfaces:**
- Produces: `normalizePersonaOtherLabel(persona: ProfessionalPersona, raw: string | null | undefined): string | null` — throws `BadRequestException` if `outro` and missing/short/long.
- Produces: write DTOs accept optional `personaOtherLabel?: string | null`.
- Produces: `updateDefaultPersona(..., defaultPersona, personaOtherLabel)`.
- Produces: auth user JSON includes `personaOtherLabel: string | null`.

- [ ] **Step 1:** Add helper + unit tests in `professional-persona` (or colocate spec next to it). `outro` + `" Fotógrafo "` → `"Fotógrafo"`. `vendedor` + `"x"` → `null`. `outro` + `"a"` → throw.

- [ ] **Step 2:** Migration SQL:

```sql
ALTER TABLE "Organization" ADD COLUMN "personaOtherLabel" TEXT;
```

- [ ] **Step 3:** Wire DTOs with `@ValidateIf` / `@MaxLength(40)` and service writes. Register `outro` without label fails. Register `outro` + label persists both. Patch to `vendedor` sets label null.

- [ ] **Step 4:** `buildAuthResponse` and GET current org select/return `personaOtherLabel`.

- [ ] **Step 5:** Run `pnpm --filter @prospectly/api test` targeting the specs touched. Expected: PASS.

---

### Task 2: Web forms (register, onboarding, settings)

**Files:**
- Modify: `apps/web/src/features/organizations/api.ts` (`updateOrganizationPersona` body + `OrganizationCurrent`)
- Modify: `apps/web/src/features/auth/api.ts` (register payload)
- Modify: `apps/web/src/types/index.ts` (`AuthUser.personaOtherLabel?: string | null`)
- Modify: `apps/web/src/pages/auth/register-page.tsx` + `register-page.test.tsx`
- Modify: `apps/web/src/pages/auth/persona-onboarding-page.tsx` + `persona-onboarding-page.test.tsx`
- Modify: `apps/web/src/pages/settings-page.tsx`
- Modify: `apps/web/src/i18n/locales/pt.json` + `en.json` (`persona.otherLabel`, `persona.otherLabelPlaceholder`)

**Interfaces:**
- Consumes: PATCH `{ defaultPersona, personaOtherLabel }`
- Produces: Input visible iff select === `outro`; submit blocked/validated when empty.

- [ ] **Step 1:** Tests: onboarding/register — choosing Outro reveals textbox; Continue/submit without text does not call API; with text sends label.

- [ ] **Step 2:** Implement Input under Select. Changing away from Outro hides input and does not send leftover text (send `null`).

- [ ] **Step 3:** Settings org persona save includes label; dirty check includes label.

- [ ] **Step 4:** Run `pnpm --filter @prospectly/web exec vitest run src/pages/auth/persona-onboarding-page.test.tsx src/pages/auth/register-page.test.tsx`. Expected: PASS.

---

### Task 3: Sidebar tag

**Files:**
- Modify: `apps/web/src/components/layout/sidebar.tsx`
- Modify: existing sidebar test if present, else `apps/web/src/components/layout/sidebar.test.tsx` (create if missing)

**Interfaces:**
- Consumes: `user.effectivePersona`, `user.personaOtherLabel`
- Produces: `Badge` between name and email.

- [ ] **Step 1:** Test: user `effectivePersona: 'outro', personaOtherLabel: 'Fotógrafo'` → document has text Fotógrafo under the name. User `vendedor` → `t('persona.vendedor')`.

- [ ] **Step 2:** Render:

```tsx
<p className="truncate text-sm font-medium text-[color:var(--ink)]">{user.name}</p>
<Badge tone="slate" className="mt-0.5 max-w-full truncate">
  {user.effectivePersona === 'outro'
    ? (user.personaOtherLabel?.trim() || t('persona.outro'))
    : t(`persona.${user.effectivePersona ?? 'vendedor'}`)}
</Badge>
<p className="truncate text-xs text-[color:var(--ink-secondary)]">{user.email}</p>
```

- [ ] **Step 3:** Run the sidebar test + a quick grep that `personaOtherLabel` is on AuthUser. PASS.

---

## Self-review

- Spec coverage: persist, 400, clear on non-outro, three write UIs, sidebar tag, no member other-label.
- No placeholders.
- Names: `personaOtherLabel` everywhere (not `otherPersona`, not `jobTitle`).

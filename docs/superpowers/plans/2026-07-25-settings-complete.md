# Settings Complete Implementation Plan

> **For agentic workers:** Implement task-by-task on branch `feat/settings-complete-ui`.

**Goal:** Complete settings hub (profile, org, billing, members invite, LGPD page, scoring polish) using existing APIs plus avatar validation.

**Architecture:** Thin API change for avatar data URLs; web feature modules for org/members; settings page composed of focused cards; new privacy route.

**Tech Stack:** NestJS + class-validator, React + TanStack Query + i18next, Tailwind dark zinc/cobalt

## Global Constraints

- Dark theme classes only (zinc-950/900, brand cobalt)
- No new storage provider
- Invite uses existing `POST /organizations/members` with client-generated temp password
- DSR remains stub (PENDING)

---

### Task 1: API avatar validation

- Modify: `apps/api/src/modules/users/dto/update-profile.dto.ts`
- Optional unit test for validator helper
- Accept https URL or data image URL ≤120KB decoded

### Task 2: Web org + DSR API helpers

- Add/extend: `apps/web/src/features/organizations/api.ts` (or auth api)
- `getCurrentOrg`, `updateOrg`, `inviteMember`, `updateMemberRole`, `removeMember`
- `requestDataExport` alongside deletion

### Task 3: Settings UI rewrite + privacy page + i18n

- Rewrite `settings-page.tsx` (split cards if file grows)
- Add `settings-privacy-page.tsx` + route in `App.tsx`
- Update `pt.json` / `en.json`
- Avatar compress helper in `lib/`
- Invite modal with generated password

### Task 4: Verify

- `pnpm --filter @prospectly/api exec tsc --noEmit` (or project script)
- `pnpm --filter @prospectly/web exec tsc -b --noEmit`
